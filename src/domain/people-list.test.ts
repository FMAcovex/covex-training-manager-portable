import { describe, expect, it } from "vitest";
import { filterPeople, type PeopleFilters } from "./people-list";
import type { Person } from "./person";
const people: Person[] = [
  { id: "1", fullName: "María ficticia", employeeCode: "SYN-01", personType: "INTERNAL", departmentId: "quality", active: true, jobTitle: "Técnica" },
  { id: "2", fullName: "Externo ficticio", personType: "EXTERNAL", active: false, company: "Empresa ficticia", jobTitle: "Consulta" },
];
const filters: PeopleFilters = { search: "", state: "", personType: "", departmentId: "" };
describe("Personal filtering A08", () => {
  it("searches accents, code, company and job title without changing original IDs", () => {
    for (const query of ["maria", "syn-01", "tecnica"]) expect(filterPeople(people, { ...filters, search: query }).map((item) => item.id)).toEqual(["1"]);
    expect(filterPeople(people, { ...filters, search: "empresa" })[0].id).toBe("2");
  });
  it("combines state, type and department, preserving inactive history", () => {
    expect(filterPeople(people, filters)).toHaveLength(2);
    expect(filterPeople(people, { ...filters, state: "INACTIVE", personType: "EXTERNAL", departmentId: "__none" }).map((item) => item.id)).toEqual(["2"]);
    expect(filterPeople(people, { ...filters, departmentId: "quality", state: "INACTIVE" })).toEqual([]);
  });
});
