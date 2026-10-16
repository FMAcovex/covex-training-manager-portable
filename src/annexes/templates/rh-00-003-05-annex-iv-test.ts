const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const margins = { left: 17, right: 17, top: 42.55, bottom: 42.55 };
const printable = PAGE_WIDTH - margins.left - margins.right;
const proportions = [32, 13, 20, 18, 24, 25, 25, 39, 25];
const total = proportions.reduce((sum, value) => sum + value, 0);

export const ANNEX_IV_TEMPLATE = {
  page: { width: PAGE_WIDTH, height: PAGE_HEIGHT, margins },
  columnWidths: proportions.map((value) => value / total * printable),
  colors: { navy: "123B5D", teal: "2A7F8E", paleBlue: "EAF2F7", paleYellow: "FFF9DF", white: "FFFFFF", border: "38556B" },
  fixedText: {
    reference: "Anexo IV del PNT Nº RH-00/003/05",
    title: "PLAN DE FORMACIÓN ANUAL",
    planned: "FORMACIONES PLANIFICADAS",
    unplanned: "FORMACIONES NO PLANIFICADAS EJECUTADAS",
    summary: "RESUMEN Y VERIFICACIÓN FINAL",
    plannedHeaders: ["CURSO", "GMP", "INTERNA/EXTERNA", "DURACIÓN (h)", "ASISTENTES / COLECTIVO", "FECHA PREVISTA", "FECHA EJECUCIÓN", "FORMADOR/ENTIDAD FORMADORA", "ESTADO"],
    unplannedHeaders: ["CURSO", "GMP", "INTERNA/EXTERNA", "DURACIÓN (h)", "ASISTENTES / COLECTIVO", "FECHA PREVISTA", "FECHA EJECUCIÓN", "FORMADOR/ENTIDAD FORMADORA", "MOTIVO"],
  },
  headerHeight: 72,
  sectionTitleHeight: 19,
  tableHeaderHeight: 30,
  lineHeight: 8.5,
  minimumRowHeight: 23,
} as const;
