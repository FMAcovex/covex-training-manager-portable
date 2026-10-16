export type CatalogItem = { id: string; code: string; name: string; active: boolean };

export type TrainingCatalogs = {
  trainingTypes: CatalogItem[];
  modalities: CatalogItem[];
  evaluationMethods: CatalogItem[];
};

// Datos exclusivamente ficticios del modo demo. La interfaz del repositorio permite
// sustituirlos por catálogos persistidos sin acoplar los componentes a estas listas.
export const demoTrainingCatalogs: TrainingCatalogs = {
  trainingTypes: [
    { id: "type-initial", code: "INI", name: "Inicial", active: true },
    { id: "type-periodic", code: "PER", name: "Periódica / reciclaje", active: true },
    { id: "type-retraining", code: "RET", name: "Reentrenamiento", active: true },
    { id: "type-extraordinary", code: "EXT", name: "Extraordinaria", active: true },
    { id: "type-quality", code: "CAL", name: "Calidad / GMP", active: true },
    { id: "type-technical", code: "TEC", name: "Técnica", active: true },
    { id: "type-safety", code: "SEG", name: "Seguridad / PRL", active: true },
    { id: "type-update", code: "ACT", name: "Actualización / cambio", active: true },
  ],
  modalities: [
    { id: "mod-in-person", code: "PRE", name: "Presencial", active: true },
    { id: "mod-online", code: "ONL", name: "Online", active: true },
    { id: "mod-mixed", code: "MIX", name: "Mixta", active: true },
  ],
  evaluationMethods: [
    { id: "eval-test", code: "TEST", name: "Prueba de conocimientos", active: true },
    { id: "eval-practical", code: "PRAC", name: "Evaluación práctica", active: true },
    { id: "eval-observation", code: "OBS", name: "Observación", active: true },
  ],
};
