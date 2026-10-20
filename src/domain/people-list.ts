import type { Person } from "@/domain/person";

export type PeopleFilters = { search: string; state: string; personType: string; departmentId: string };
const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
export function filterPeople(people: Person[], filters: PeopleFilters) {
  const query = normalized(filters.search.trim());
  return people.filter((person) => (!query || normalized([person.fullName, person.employeeCode, person.company, person.jobTitle].filter(Boolean).join(" ")).includes(query))
    && (!filters.state || person.active === (filters.state === "ACTIVE"))
    && (!filters.personType || person.personType === filters.personType)
    && (!filters.departmentId || (person.departmentId ?? "__none") === filters.departmentId));
}
