export const PORTABLE_PRISMA_MODELS = [
  "Person",
  "Department",
  "UserProfile",
  "TrainingType",
  "Modality",
  "EvaluationMethod",
  "Training",
  "TrainingPlannedTrainer",
  "TrainingTargetDepartment",
  "TrainingCodeSequence",
  "TrainingSession",
  "TrainingSessionTrainer",
  "DocumentControl",
  "DocumentControlAttachment",
  "Attendance",
  "SessionCodeSequence",
  "TemplateVersion",
  "GeneratedDocument",
  "AuditEvent",
  "TrainingImportRun",
  "TrainerQualification",
  "TrainerDocument",
] as const;

export type PortableModel = typeof PORTABLE_PRISMA_MODELS[number];
export type PortableListModel = PortableModel | "CovexOperation";

export type PortableColumnDefinition = {
  name: string;
  type: "text" | "multilineText" | "number" | "boolean" | "dateTime";
  indexed?: boolean;
  unique?: boolean;
  required?: boolean;
};

const commonColumns: PortableColumnDefinition[] = [
  { name: "CovexId", type: "text", indexed: true, unique: true, required: true },
  { name: "CovexUniqueKey", type: "text", indexed: true, unique: true },
  { name: "CovexParentId", type: "text", indexed: true },
  { name: "CovexYear", type: "number", indexed: true },
  { name: "CovexStatus", type: "text", indexed: true },
  { name: "CovexCorrelationId", type: "text", indexed: true },
  { name: "CovexUpdatedAt", type: "dateTime", indexed: true, required: true },
  { name: "CovexPayload", type: "multilineText", required: true },
];

export type PortableListDefinition = {
  model: PortableListModel;
  displayName: (prefix: string) => string;
  columns: PortableColumnDefinition[];
};

export const PORTABLE_LIST_SCHEMA: PortableListDefinition[] = [
  ...PORTABLE_PRISMA_MODELS.map((model) => ({
    model,
    displayName: (prefix: string) => `${prefix}-${model}`,
    columns: commonColumns,
  })),
  {
    model: "CovexOperation",
    displayName: (prefix: string) => `${prefix}-CovexOperation`,
    columns: commonColumns,
  },
];

export function portableListName(model: PortableListModel, prefix: string) {
  return PORTABLE_LIST_SCHEMA.find((item) => item.model === model)!.displayName(prefix);
}

export function assertCompletePortableSchema() {
  const configured = new Set(PORTABLE_LIST_SCHEMA.map((item) => item.model));
  const missing = PORTABLE_PRISMA_MODELS.filter((model) => !configured.has(model));
  if (missing.length) throw new Error(`Faltan modelos en el esquema portable: ${missing.join(", ")}`);
  return true;
}
