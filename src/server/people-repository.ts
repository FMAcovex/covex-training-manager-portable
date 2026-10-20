import type { Department } from "@/domain/department";
import type { Person, PersonInput } from "@/domain/person";
import { getDemoCatalogStore, type DemoCatalogStore } from "@/administration/demo-catalog-store";
import { readDemoJson, writeDemoJson } from "@/demo/demo-data-store";
import type { AuditEventRepository } from "@/administration/audit-repository";

export interface PeopleRepository {
  list(): Promise<Person[]>;
  findById(id: string): Promise<Person | undefined>;
  create(input: PersonInput, actorUserId?: string): Promise<Person>;
  rollbackCreated(id: string): Promise<void>;
  update(id: string, input: PersonInput, actorUserId?: string): Promise<Person | undefined>;
  deactivate(id: string, actorUserId?: string): Promise<Person | undefined>;
  activate(id: string, actorUserId?: string): Promise<Person | undefined>;
  listDepartments(options?: { includeInactive?: boolean }): Promise<Department[]>;
}
export class PeopleDepartmentReferenceError extends Error {}
export class PeopleDuplicateCodeError extends Error {
  constructor() { super("El código de empleado ya pertenece a otra persona, activa o histórica."); }
}

export class InMemoryPeopleRepository implements PeopleRepository {
  private people: Person[];
  private departments: Department[];

  constructor(
    people?: Person[],
    catalogStore: DemoCatalogStore | Department[] = getDemoCatalogStore(),
    private readonly persist = false,
    private readonly audit?: AuditEventRepository,
  ) {
    const defaults: Person[] = [
      { id: "demo-1", fullName: "Persona Demo Calidad", employeeCode: "DEMO-001", personType: "INTERNAL", departmentId: "quality", jobTitle: "Técnico/a de calidad", notes: "Dato ficticio", active: true },
      { id: "demo-2", fullName: "Persona Demo Externa", employeeCode: "DEMO-002", personType: "EXTERNAL", company: "Proveedor Demo", departmentId: "production", jobTitle: "Consultor/a", notes: "Dato ficticio", active: true },
      { id: "demo-3", fullName: "Persona Demo Histórica", employeeCode: "DEMO-003", personType: "INTERNAL", departmentId: "production", jobTitle: "Operario/a de demostración", notes: "Persona ficticia inactiva con histórico", active: false },
    ];
    this.people = structuredClone(people ?? (persist ? readDemoJson<Person[]>("people-current.json") : undefined) ?? defaults);
    this.departments = Array.isArray(catalogStore) ? catalogStore : catalogStore.departments;
  }

  private save() { if (this.persist) writeDemoJson("people-current.json", this.people); }

  async list() { return this.people; }
  async findById(id: string) { return this.people.find((person) => person.id === id); }
  private validateDepartment(input: PersonInput, existing?: Person) {
    if (!input.departmentId) return;
    const department = this.departments.find((item) => item.id === input.departmentId);
    if (!department || (!department.active && input.departmentId !== existing?.departmentId)) throw new PeopleDepartmentReferenceError("El departamento seleccionado no existe o está inactivo");
  }
  async create(input: PersonInput, actorUserId?: string) {
    this.validateDepartment(input);
    this.validateEmployeeCode(input);
    const person = { ...input, id: crypto.randomUUID(), active: true };
    if (actorUserId && this.audit) await this.audit.append({ actorUserId, entityType: "PERSON", entityId: person.id, action: "PERSON_CREATED", afterJson: person });
    this.people = [...this.people, person];
    this.save();
    return person;
  }
  async rollbackCreated(id: string) { this.people = this.people.filter((person) => person.id !== id); this.save(); }
  async update(id: string, input: PersonInput, actorUserId?: string) {
    const existing = await this.findById(id);
    if (!existing) return undefined;
    this.validateDepartment(input, existing);
    this.validateEmployeeCode(input, id);
    const updated = { ...existing, ...input };
    if (actorUserId && this.audit) await this.audit.append({ actorUserId, entityType: "PERSON", entityId: id, action: "PERSON_UPDATED", beforeJson: existing, afterJson: updated });
    this.people = this.people.map((person) => person.id === id ? updated : person);
    this.save();
    return structuredClone(updated);
  }
  async deactivate(id: string, actorUserId?: string) {
    const person = await this.findById(id);
    if (!person) return undefined;
    const updated = { ...person, active: false };
    if (actorUserId && this.audit) await this.audit.append({ actorUserId, entityType: "PERSON", entityId: id, action: "PERSON_DEACTIVATED", beforeJson: person, afterJson: updated });
    this.people = this.people.map((item) => item.id === id ? updated : item);
    this.save();
    return structuredClone(updated);
  }
  async activate(id: string, actorUserId?: string) {
    const person = await this.findById(id);
    if (!person) return undefined;
    const updated = { ...person, active: true };
    if (actorUserId && this.audit) await this.audit.append({ actorUserId, entityType: "PERSON", entityId: id, action: "PERSON_ACTIVATED", beforeJson: person, afterJson: updated });
    this.people = this.people.map((item) => item.id === id ? updated : item);
    this.save();
    return structuredClone(updated);
  }
  async listDepartments(options?: { includeInactive?: boolean }) { return options?.includeInactive ? this.departments : this.departments.filter((department) => department.active); }
  private validateEmployeeCode(input: PersonInput, exceptId?: string) {
    if (input.employeeCode && this.people.some((person) => person.id !== exceptId && person.employeeCode === input.employeeCode)) throw new PeopleDuplicateCodeError();
  }
}
