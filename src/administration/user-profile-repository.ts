import type { CurrentUser } from "@/auth/current-user";
import type { AuditEventRepository } from "./audit-repository";
import { AdminConflictError, type UserCreateInput, type UserProfile, type UserUpdateInput } from "./types";

export interface UserProfileRepository {
  list(): Promise<UserProfile[]>;
  findById(id: string): Promise<UserProfile | undefined>;
  findByEntraObjectId(entraObjectId: string): Promise<UserProfile | undefined>;
  create(input: UserCreateInput, actor: CurrentUser): Promise<UserProfile>;
  update(id: string, input: UserUpdateInput, actor: CurrentUser): Promise<UserProfile | undefined>;
}

const demoTime = "2026-07-01T09:00:00.000Z";
export const demoUserProfiles: UserProfile[] = [
  { id: "demo-user", entraObjectId: "demo-object-id", email: "demo@covex.example", displayName: "Administrador Demo", role: "ADMIN", active: true, createdAt: demoTime, updatedAt: demoTime },
  { id: "demo-responsible", entraObjectId: "demo-responsible-object", email: "responsable@demo.example", displayName: "Responsable Ficticio", role: "RESPONSIBLE", active: true, createdAt: demoTime, updatedAt: demoTime },
  { id: "demo-basic-user", entraObjectId: "demo-user-object", email: "usuario@demo.example", displayName: "Usuario Ficticio", role: "USER", active: true, createdAt: demoTime, updatedAt: demoTime },
  { id: "demo-inactive-user", entraObjectId: "demo-inactive-object", email: "inactivo@demo.example", displayName: "Usuario Inactivo Ficticio", role: "USER", active: false, createdAt: demoTime, updatedAt: demoTime },
];

export class InMemoryUserProfileRepository implements UserProfileRepository {
  private users: UserProfile[];
  constructor(private readonly audit: AuditEventRepository, seed: UserProfile[] = demoUserProfiles) { this.users = structuredClone(seed); }
  async list() { return structuredClone(this.users.sort((a, b) => a.displayName.localeCompare(b.displayName, "es"))); }
  async findById(id: string) { const user = this.users.find((item) => item.id === id); return user ? structuredClone(user) : undefined; }
  async findByEntraObjectId(entraObjectId: string) {
    const normalized = entraObjectId.trim().toLocaleLowerCase();
    const user = this.users.find((item) => item.entraObjectId.toLocaleLowerCase() === normalized);
    return user ? structuredClone(user) : undefined;
  }
  private assertUnique(input: { email?: string; entraObjectId?: string }, excludedId?: string) {
    if (input.email && this.users.some((item) => item.id !== excludedId && item.email.toLocaleLowerCase() === input.email!.toLocaleLowerCase())) throw new AdminConflictError("El email ya existe");
    if (input.entraObjectId && this.users.some((item) => item.id !== excludedId && item.entraObjectId === input.entraObjectId)) throw new AdminConflictError("El identificador Entra ya existe");
  }
  async create(input: UserCreateInput, actor: CurrentUser) {
    this.assertUnique(input); const timestamp = new Date().toISOString();
    const user: UserProfile = { ...input, id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp };
    await this.audit.append({ actorUserId: actor.id, entityType: "USER_PROFILE", entityId: user.id, action: "USER_PROFILE_CREATED", afterJson: user });
    this.users.push(user); return structuredClone(user);
  }
  async update(id: string, input: UserUpdateInput, actor: CurrentUser) {
    const index = this.users.findIndex((item) => item.id === id); if (index < 0) return undefined;
    const before = this.users[index]; this.assertUnique(input, id);
    const after = { ...before, ...input, updatedAt: new Date().toISOString() };
    if (before.role === "ADMIN" && before.active && (after.role !== "ADMIN" || !after.active) && !this.users.some((item) => item.id !== id && item.role === "ADMIN" && item.active)) throw new AdminConflictError("Debe existir al menos un ADMIN activo");
    const common = { actorUserId: actor.id, entityType: "USER_PROFILE", entityId: id, beforeJson: before, afterJson: after };
    if (before.role !== after.role) await this.audit.append({ ...common, action: "USER_ROLE_CHANGED" });
    if (before.active !== after.active) await this.audit.append({ ...common, action: after.active ? "USER_ACTIVATED" : "USER_DEACTIVATED" });
    if (before.email !== after.email || before.displayName !== after.displayName) await this.audit.append({ ...common, action: "USER_PROFILE_UPDATED" });
    this.users[index] = after; return structuredClone(after);
  }
}
