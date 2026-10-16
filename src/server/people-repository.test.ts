import { describe, expect, it } from "vitest";
import { InMemoryPeopleRepository, PeopleDepartmentReferenceError } from "./people-repository";

const internal = { fullName: "Persona Ficticia", employeeCode: undefined, personType: "INTERNAL" as const, departmentId: "quality", jobTitle: "Técnico/a", notes: undefined };

describe("PeopleRepository en memoria", () => {
  it("desactiva lógicamente sin eliminar la persona", async () => {
    const repository = new InMemoryPeopleRepository();
    const created = await repository.create(internal);
    const deactivated = await repository.deactivate(created.id);
    expect(deactivated?.active).toBe(false);
    expect((await repository.findById(created.id))?.active).toBe(false);
    expect((await repository.list()).some((person) => person.id === created.id)).toBe(true);
  });

  it("reactiva la misma persona conservando ID e histórico", async () => {
    const repository = new InMemoryPeopleRepository();
    const created = await repository.create(internal);
    await repository.deactivate(created.id);
    const reactivated = await repository.activate(created.id);
    expect(reactivated).toMatchObject({ id: created.id, active: true, fullName: created.fullName });
    expect((await repository.list()).filter((person) => person.id === created.id)).toHaveLength(1);
  });

  it("devuelve undefined para IDs inexistentes en cambios de estado", async () => {
    const repository = new InMemoryPeopleRepository();
    expect(await repository.deactivate("missing")).toBeUndefined();
    expect(await repository.activate("missing")).toBeUndefined();
  });

  it("excluye departamentos inactivos en selección pero los recupera para históricos", async () => {
    const repository = new InMemoryPeopleRepository([], [
      { id: "active", code: "ACT", name: "Activo Ficticio", active: true },
      { id: "historical", code: "HIS", name: "Histórico Ficticio", active: false },
    ]);
    expect(await repository.listDepartments()).toHaveLength(1);
    expect(await repository.listDepartments({ includeInactive: true })).toHaveLength(2);
  });

  it("conserva el departamento inactivo actual pero impide nuevas asignaciones inactivas", async () => {
    const departments = [
      { id: "historical", code: "HIS", name: "Histórico Ficticio", active: false },
      { id: "other-historical", code: "OTH", name: "Otro Histórico", active: false },
    ];
    const repository = new InMemoryPeopleRepository([{ id: "person", ...internal, departmentId: "historical", active: true }], departments);
    await expect(repository.update("person", { ...internal, departmentId: "historical", jobTitle: "Responsable" })).resolves.toMatchObject({ departmentId: "historical" });
    await expect(repository.create({ ...internal, departmentId: "historical" })).rejects.toBeInstanceOf(PeopleDepartmentReferenceError);
    await expect(repository.update("person", { ...internal, departmentId: "other-historical" })).rejects.toBeInstanceOf(PeopleDepartmentReferenceError);
  });
});
