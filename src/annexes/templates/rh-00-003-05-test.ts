/**
 * Fixture TEST sanitizado. Conserva únicamente geometría, textos fijos y colores
 * observados en la referencia; no contiene datos históricos ni personales.
 */
export const RH_00_003_05_TEST_TEMPLATE = {
  id: "RH-00/003/05-TEST-1",
  page: { width: 595.28, height: 841.89, margins: { left: 25.2, right: 25.2, top: 32.4, bottom: 32.4 } },
  font: { regular: "Helvetica", bold: "Helvetica-Bold", size: 8 },
  colors: {
    navy: "1F4E78",
    teal: "0F6B78",
    paleBlue: "EDF4FB",
    paleYellow: "FFF2CC",
    border: "8EA9DB",
    white: "FFFFFF",
    black: "000000",
  },
  fixedText: {
    annexReference: "Anexo III del PNT Nº RH-00/003/05",
    title: "REGISTRO DE ASISTENCIA Y EVALUACIÓN DE SESIÓN FORMATIVA",
    content: "CONTENIDO DE LA FORMACIÓN",
    attendeeHeaders: ["Nº", "Empleado", "Departamento", "Puesto", "Firma", "Apto /No Apto"],
    observations: "Observaciones:",
    responsible: "Formador / responsable:",
  },
  attendeeColumnWidths: [62.27, 124.54, 81.73, 108.98, 97.3, 70.06],
  detailColumnWidth: 268.54,
  contentColumnWidth: 276.34,
  detailLabelWidth: 62.27,
  detailMinimumHeights: [24, 30, 24, 30, 24, 24, 30, 30],
  headerHeight: 70,
  tableHeaderHeight: 26,
  attendeeMinimumHeight: 18,
  lineHeight: 9,
  observationLabelWidth: 62.27,
  observationLabelHeight: 28,
  responsibleLabelWidth: 186.81,
} as const;
