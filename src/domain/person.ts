import { z } from "zod";

export const personTypeSchema = z.enum(["INTERNAL", "EXTERNAL"]);
export const personInputSchema = z.object({
  fullName: z.string().trim().min(1, "El nombre es obligatorio"),
  employeeCode: z.string().trim().optional(),
  personType: personTypeSchema,
  company: z.string().trim().optional(),
  departmentId: z.string().trim().optional(),
  jobTitle: z.string().trim().min(1, "El puesto es obligatorio"),
  notes: z.string().trim().optional(),
}).superRefine((person, context) => {
  if (person.personType === "INTERNAL" && !person.departmentId) context.addIssue({ code: z.ZodIssueCode.custom, path: ["departmentId"], message: "El departamento es obligatorio para personal interno" });
  if (person.personType === "EXTERNAL" && !person.company) context.addIssue({ code: z.ZodIssueCode.custom, path: ["company"], message: "La empresa es obligatoria para personal externo" });
});

export type PersonInput = z.infer<typeof personInputSchema>;
export type Person = PersonInput & { id: string; active: boolean };

export function validatePerson(input: unknown): PersonInput {
  const parsed = personInputSchema.parse(input);
  return normalizePersonInput(parsed);
}

export function normalizePersonInput(input: PersonInput): PersonInput {
  return {
    ...input,
    employeeCode: input.employeeCode || undefined,
    company: input.company || undefined,
    departmentId: input.departmentId || undefined,
    notes: input.notes || undefined,
  };
}
