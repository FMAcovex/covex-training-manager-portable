import { AsyncLocalStorage } from "node:async_hooks";
import { GraphConflictError } from "@/portable/graph/graph-client";
import type { PortableEntityStore, PortableRecord } from "./entity-store";
import { PortablePartialWriteError } from "./unit-of-work";

export const PORTABLE_WRITE_LOCK_ID = "portable-global-write-lock";
type Lock = { state: "FREE" | "HELD" | "NEEDS_RECONCILIATION"; operationId?: string };
type Target = { model: string; id: string; action: "create" | "update" | "delete" };
export type WriteOperation = {
  kind: string;
  state: "RUNNING" | "COMMITTED" | "ABORTED" | "NEEDS_RECONCILIATION";
  startedAt: string;
  finishedAt?: string;
  targets: Target[];
  targetCount?: number;
  segments?: string[];
  errorCode?: string;
};

type Context = { operation: PortableRecord<WriteOperation>; targets: Target[]; targetCount: number; segments: string[]; externalWrite: boolean };

/**
 * SharePoint has no cross-list transactions. Serialize portable writes across
 * installations, record every intended mutation before sending it, and fail closed
 * after uncertain/partial writes. Locks never expire automatically: IT reconciles
 * abandoned operations instead of allowing another client to overwrite their work.
 */
export class PortableWriteCoordinator {
  private readonly context = new AsyncLocalStorage<Context>();
  readonly store: PortableEntityStore;

  constructor(private readonly raw: PortableEntityStore) {
    this.store = {
      list: (...args) => raw.list(...args),
      get: (...args) => raw.get(...args),
      findUnique: (...args) => raw.findUnique(...args),
      create: async (model, id, data, indexes) => {
        await this.before({ model, id, action: "create" });
        return raw.create(model, id, data, indexes);
      },
      update: async (model, current, data, indexes) => {
        await this.before({ model, id: current.id, action: "update" });
        return raw.update(model, current, data, indexes);
      },
      delete: async (model, current) => {
        await this.before({ model, id: current.id, action: "delete" });
        return raw.delete(model, current);
      },
    };
  }

  get operationKind() { return this.context.getStore()?.operation.data.kind; }

  private async before(target: Target) {
    const context = this.context.getStore();
    if (!context) throw new Error("Las escrituras portable requieren una operación coordinada.");
    if (context.targets.length >= 100) {
      const id = `${context.operation.id}:targets:${context.segments.length + 1}`;
      await this.raw.create("CovexOperation", id, { state: "DETAIL", targets: context.targets, operationId: context.operation.id }, { parentId: context.operation.id, correlationId: context.operation.id, status: "DETAIL" });
      context.segments.push(id);
      context.targets = [];
    }
    context.targets.push(target);
    context.targetCount += 1;
    context.operation = await this.raw.update("CovexOperation", context.operation, {
      ...context.operation.data, targets: context.targets, targetCount: context.targetCount, segments: context.segments,
    }, { status: "RUNNING", correlationId: context.operation.id });
  }

  /** Call before any drive mutation, so a timeout cannot become an invisible orphan. */
  async externalWrite(target: Target) {
    await this.before(target);
    this.context.getStore()!.externalWrite = true;
  }

  async execute<T>(kind: string, action: () => Promise<T>): Promise<T> {
    if (this.context.getStore()) return action();
    const operationId = crypto.randomUUID();
    const current = await this.raw.get<Lock>("CovexOperation", PORTABLE_WRITE_LOCK_ID);
    if (current && current.data.state !== "FREE") {
      if (current.data.state === "NEEDS_RECONCILIATION") throw new PortablePartialWriteError(current.data.operationId ?? current.id);
      throw new GraphConflictError(`Hay una operación de escritura en curso (${current.data.operationId ?? current.id}). Espera y vuelve a intentarlo. Si se interrumpió, solicita reconciliación a IT.`);
    }
    let lock: PortableRecord<Lock>;
    try {
      const held: Lock = { state: "HELD", operationId };
      lock = current
        ? await this.raw.update("CovexOperation", current, held, { uniqueKey: PORTABLE_WRITE_LOCK_ID, status: "HELD", correlationId: operationId })
        : await this.raw.create("CovexOperation", PORTABLE_WRITE_LOCK_ID, held, { uniqueKey: PORTABLE_WRITE_LOCK_ID, status: "HELD", correlationId: operationId });
    } catch (error) {
      if (error instanceof GraphConflictError) throw error;
      throw new PortablePartialWriteError(operationId);
    }
    let context: Context | undefined;
    try {
      const operation = await this.raw.create<WriteOperation>("CovexOperation", operationId, {
        kind, state: "RUNNING", startedAt: new Date().toISOString(), targets: [],
      }, { status: "RUNNING", correlationId: operationId });
      context = { operation, targets: [], targetCount: 0, segments: [], externalWrite: false };
      const result = await this.context.run(context, action);
      await this.raw.update("CovexOperation", context.operation, {
        ...context.operation.data, state: "COMMITTED", finishedAt: new Date().toISOString(), targets: context.targets,
      }, { status: "COMMITTED", correlationId: operationId });
      await this.release(lock);
      return result;
    } catch (error) {
      // A validation rejection before any target was recorded cannot have changed
      // business data. Every other failure is deliberately treated as uncertain.
      const uncertain = !context || context.targetCount > 0 || context.externalWrite;
      try {
        if (context) await this.raw.update("CovexOperation", context.operation, {
          ...context.operation.data, state: uncertain ? "NEEDS_RECONCILIATION" : "ABORTED",
          finishedAt: new Date().toISOString(), targets: context.targets,
          errorCode: error instanceof Error ? error.name : "UnknownError",
        }, { status: uncertain ? "NEEDS_RECONCILIATION" : "ABORTED", correlationId: operationId });
        if (uncertain) await this.raw.update("CovexOperation", lock, { state: "NEEDS_RECONCILIATION", operationId }, {
          uniqueKey: PORTABLE_WRITE_LOCK_ID, status: "NEEDS_RECONCILIATION", correlationId: operationId,
        });
        else await this.release(lock);
      } catch {
        // Persisted HELD/RUNNING records continue blocking writes even if the
        // connection disappears while recording the failure.
        throw new PortablePartialWriteError(operationId);
      }
      if (uncertain) throw new PortablePartialWriteError(operationId);
      throw error;
    }
  }

  private async release(lock: PortableRecord<Lock>) {
    await this.raw.update("CovexOperation", lock, { state: "FREE" }, { uniqueKey: PORTABLE_WRITE_LOCK_ID, status: "FREE" });
  }

  guard<T extends object>(repository: T, label: string, mutations: Array<keyof T>): T {
    const names = new Set<PropertyKey>(mutations);
    return new Proxy(repository, {
      get: (target, property, receiver) => {
        const value = Reflect.get(target, property, receiver);
        if (typeof value !== "function") return value;
        if (!names.has(property)) return value.bind(target);
        return (...args: unknown[]) => this.execute(`${label}.${String(property)}`, () => Reflect.apply(value, target, args));
      },
    });
  }
}
