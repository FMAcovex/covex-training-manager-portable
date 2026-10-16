import type { PortableEntityStore, PortableRecord } from "@/portable/sharepoint/entity-store";

type OperationState = "PREPARING" | "RUNNING" | "COMMITTED" | "ABORTED" | "NEEDS_RECONCILIATION";
type OperationData = {
  kind: string;
  idempotencyKey: string;
  state: OperationState;
  completedSteps: string[];
  failedStep?: string;
  errorCode?: string;
  startedAt: string;
  finishedAt?: string;
};

export type PortableOperationStep = {
  name: string;
  execute: () => Promise<void>;
  compensate?: () => Promise<void>;
};

export class PortablePartialWriteError extends Error {
  constructor(readonly correlationId: string) {
    super(`La operación ${correlationId} requiere reconciliación; no continúes hasta revisarla.`);
    this.name = "PortablePartialWriteError";
  }
}

export class PortableUnitOfWork {
  constructor(private readonly store: PortableEntityStore) {}

  async execute(kind: string, steps: PortableOperationStep[], options: { idempotencyKey?: string; correlationId?: string } = {}) {
    const correlationId = options.correlationId ?? crypto.randomUUID();
    const idempotencyKey = options.idempotencyKey ?? correlationId;
    const prior = await this.store.findUnique<OperationData>("CovexOperation", idempotencyKey);
    if (prior) {
      if (prior.data.state === "COMMITTED") return { correlationId: prior.id, replay: true };
      throw new PortablePartialWriteError(prior.id);
    }
    let operation = await this.store.create<OperationData>("CovexOperation", correlationId, {
      kind, idempotencyKey, state: "PREPARING", completedSteps: [], startedAt: new Date().toISOString(),
    }, { uniqueKey: idempotencyKey, status: "PREPARING", correlationId });
    const completed: PortableOperationStep[] = [];
    let executing: PortableOperationStep | undefined;
    try {
      operation = await this.advance(operation, { ...operation.data, state: "RUNNING" });
      for (const step of steps) {
        executing = step;
        await step.execute();
        completed.push(step);
        executing = undefined;
        operation = await this.advance(operation, { ...operation.data, completedSteps: completed.map((item) => item.name) });
      }
      await this.advance(operation, { ...operation.data, state: "COMMITTED", finishedAt: new Date().toISOString() });
      return { correlationId, replay: false };
    } catch (error) {
      let compensationFailed = false;
      const failed = executing;
      if (failed) {
        if (!failed.compensate) compensationFailed = true;
        else try { await failed.compensate(); } catch { compensationFailed = true; }
      }
      for (const step of completed.reverse()) {
        if (!step.compensate) { compensationFailed = true; continue; }
        try { await step.compensate(); } catch { compensationFailed = true; }
      }
      const failedStep = failed?.name;
      try { await this.advance(operation, {
        ...operation.data,
        state: compensationFailed ? "NEEDS_RECONCILIATION" : "ABORTED",
        failedStep,
        errorCode: error instanceof Error ? error.name : "UnknownError",
        finishedAt: new Date().toISOString(),
      }); } catch { throw new PortablePartialWriteError(correlationId); }
      if (compensationFailed) throw new PortablePartialWriteError(correlationId);
      throw error;
    }
  }

  private advance(operation: PortableRecord<OperationData>, data: OperationData) {
    return this.store.update<OperationData>("CovexOperation", operation, data, {
      uniqueKey: data.idempotencyKey,
      status: data.state,
      correlationId: operation.id,
    });
  }
}
