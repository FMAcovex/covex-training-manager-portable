import { demoTrainingCatalogs, type CatalogItem, type TrainingCatalogs } from "@/domain/training-catalogs";
import type { Department } from "@/domain/department";
import { readDemoJson, writeDemoJson } from "@/demo/demo-data-store";

export type DemoCatalogStore = TrainingCatalogs & { departments: Department[] };

const defaultDepartments: Department[] = [
  { id: "quality", code: "GC", name: "Garantía de Calidad", active: true },
  { id: "technical-direction", code: "DT", name: "Dirección Técnica", active: true },
  { id: "qc-physchem", code: "FQ", name: "Control de Calidad · Fisicoquímico", active: true },
  { id: "qc-micro", code: "MICRO", name: "Control de Calidad · Microbiología", active: true },
  { id: "stability", code: "EST", name: "Estabilidad", active: true },
  { id: "production", code: "PM-10", name: "Producción Farma · PM-10", active: true },
  { id: "packaging", code: "PA-20", name: "Acondicionamiento · PA-20", active: true },
  { id: "logistics-10", code: "LG-10", name: "Logística · LG-10", active: true },
  { id: "logistics-20", code: "LG-20", name: "Logística · LG-20", active: true },
  { id: "logistics-30", code: "LG-30", name: "Logística · LG-30", active: true },
  { id: "logistics-40", code: "LG-40", name: "Logística · LG-40", active: true },
  { id: "purchasing", code: "COM", name: "Compras", active: true },
  { id: "import-export", code: "IMEX", name: "Import-Export", active: true },
  { id: "maintenance-10", code: "MC-10", name: "Mantenimiento · MC-10", active: true },
  { id: "maintenance-20", code: "MC-20", name: "Ingeniería / Mantenimiento · MC-20", active: true },
  { id: "it", code: "SG-20", name: "Sistemas Informáticos · SG-20", active: true },
  { id: "hr", code: "RRHH", name: "Recursos Humanos", active: true },
  { id: "environment", code: "MA-00", name: "Medio Ambiente · MA-00", active: true },
  { id: "historical-department", code: "HIS", name: "Departamento histórico ficticio", active: false },
];

const catalogRows = (fileName: string, fallback: CatalogItem[]) =>
  (readDemoJson<Array<CatalogItem & { referenced?: boolean }>>(fileName) ?? fallback)
    .map(({ id, code, name, active }) => ({ id, code, name, active }));

const departmentRows = () =>
  (readDemoJson<Array<Department & { referenced?: boolean }>>("departments-current.json") ?? defaultDepartments)
    .map(({ id, code, name, active }) => ({ id, code, name, active }));

const globalStore = globalThis as unknown as { covexDemoCatalogStore?: DemoCatalogStore };

export function getDemoCatalogStore(): DemoCatalogStore {
  globalStore.covexDemoCatalogStore ??= {
    trainingTypes: catalogRows("training-types-current.json", structuredClone(demoTrainingCatalogs.trainingTypes)),
    modalities: catalogRows("modalities-current.json", structuredClone(demoTrainingCatalogs.modalities)),
    evaluationMethods: catalogRows("evaluation-methods-current.json", structuredClone(demoTrainingCatalogs.evaluationMethods)),
    departments: departmentRows(),
  };
  return globalStore.covexDemoCatalogStore;
}

export function persistDemoCatalogStore(store: DemoCatalogStore) {
  writeDemoJson("training-types-current.json", store.trainingTypes);
  writeDemoJson("modalities-current.json", store.modalities);
  writeDemoJson("evaluation-methods-current.json", store.evaluationMethods);
  writeDemoJson("departments-current.json", store.departments);
}

export function listForKind(store: DemoCatalogStore, kind: "training-types" | "modalities" | "evaluation-methods" | "departments"): CatalogItem[] {
  return kind === "training-types" ? store.trainingTypes : kind === "modalities" ? store.modalities : kind === "evaluation-methods" ? store.evaluationMethods : store.departments;
}
