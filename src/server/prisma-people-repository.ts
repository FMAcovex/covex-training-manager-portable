import { Prisma, PrismaClient, type PersonType } from "@prisma/client";
import type { Department } from "@/domain/department";
import type { Person, PersonInput } from "@/domain/person";
import { PeopleDepartmentReferenceError, type PeopleRepository } from "@/server/people-repository";
import { auditData } from "@/administration/prisma-audit-repository";

type PrismaPerson = { id: string; employeeCode: string | null; fullName: string; personType: PersonType; company: string | null; departmentId: string | null; jobTitle: string; notes: string | null; active: boolean };
const toPerson = (person: PrismaPerson): Person => ({ ...person, personType: person.personType as Person["personType"], employeeCode: person.employeeCode ?? undefined, company: person.company ?? undefined, departmentId: person.departmentId ?? undefined, notes: person.notes ?? undefined });

export class PrismaPeopleRepository implements PeopleRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async list() { return (await this.prisma.person.findMany({ orderBy: { fullName: "asc" } })).map(toPerson); }
  async findById(id: string) { const person = await this.prisma.person.findUnique({ where: { id } }); return person ? toPerson(person) : undefined; }
  private async validateDepartment(input: PersonInput, currentDepartmentId: string | undefined, client: PrismaClient | Prisma.TransactionClient) {
    if (!input.departmentId) return;
    const department = await client.department.findUnique({ where: { id: input.departmentId } });
    if (!department || (!department.active && input.departmentId !== currentDepartmentId)) throw new PeopleDepartmentReferenceError("El departamento seleccionado no existe o está inactivo");
  }
  async create(input: PersonInput, actorUserId?: string) {
    return this.prisma.$transaction(async (transaction) => {
      await this.validateDepartment(input, undefined, transaction);
      const person = await transaction.person.create({ data: { ...input, personType: input.personType as PersonType, employeeCode: input.employeeCode ?? null, company: input.company ?? null, departmentId: input.departmentId ?? null, notes: input.notes ?? null } });
      const result = toPerson(person);
      if (actorUserId) await transaction.auditEvent.create({ data: auditData({ actorUserId, entityType: "PERSON", entityId: person.id, action: "PERSON_CREATED", afterJson: result }) });
      return result;
    });
  }
  async rollbackCreated(id: string) { await this.prisma.person.delete({ where: { id } }); }
  async update(id: string, input: PersonInput, actorUserId?: string) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.person.findUnique({ where: { id } });
      if (!existing) return undefined;
      await this.validateDepartment(input, existing.departmentId ?? undefined, transaction);
      const person = await transaction.person.update({ where: { id }, data: { ...input, personType: input.personType as PersonType, employeeCode: input.employeeCode ?? null, company: input.company ?? null, departmentId: input.departmentId ?? null, notes: input.notes ?? null } });
      const before = toPerson(existing);
      const after = toPerson(person);
      if (actorUserId) await transaction.auditEvent.create({ data: auditData({ actorUserId, entityType: "PERSON", entityId: id, action: "PERSON_UPDATED", beforeJson: before, afterJson: after }) });
      return after;
    });
  }
  async deactivate(id: string, actorUserId?: string) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.person.findUnique({ where: { id } });
      if (!existing) return undefined;
      const person = await transaction.person.update({ where: { id }, data: { active: false } });
      const before = toPerson(existing);
      const after = toPerson(person);
      if (actorUserId) await transaction.auditEvent.create({ data: auditData({ actorUserId, entityType: "PERSON", entityId: id, action: "PERSON_DEACTIVATED", beforeJson: before, afterJson: after }) });
      return after;
    });
  }
  async activate(id: string, actorUserId?: string) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.person.findUnique({ where: { id } });
      if (!existing) return undefined;
      const person = await transaction.person.update({ where: { id }, data: { active: true } });
      const before = toPerson(existing);
      const after = toPerson(person);
      if (actorUserId) await transaction.auditEvent.create({ data: auditData({ actorUserId, entityType: "PERSON", entityId: id, action: "PERSON_ACTIVATED", beforeJson: before, afterJson: after }) });
      return after;
    });
  }
  async listDepartments(options?: { includeInactive?: boolean }) { return this.prisma.department.findMany({ where: options?.includeInactive ? undefined : { active: true }, orderBy: { name: "asc" } }) as Promise<Department[]>; }
}
