const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const margins = { left: 25.5, right: 25.5, top: 28.4, bottom: 28.4 };
const printable = PAGE_WIDTH - margins.left - margins.right;
const proportions = [30.332, 28, 22, 25.332, 20, 10.664, 17.887, 19];
const total = proportions.reduce((sum, value) => sum + value, 0);

export const ANNEX_V_TEMPLATE = {
  page: { width: PAGE_WIDTH, height: PAGE_HEIGHT, margins },
  columnWidths: proportions.map((value) => value / total * printable),
  colors: { navy: "123B5D", teal: "2A7F8E", paleBlue: "EAF2F7", paleYellow: "FFF9DF", white: "FFFFFF", border: "38556B" },
  fixedText: {
    reference: "Anexo V del PNT Nº RH-00/003/05",
    title: "RESUMEN INDIVIDUAL DE FORMACIONES",
    headers: ["FORMACIÓN", "FECHA", "TIPO", "MATERIAL/REFERENCIA", "ESTADO", "RESULTADO", "PRÓXIMA RENOVACIÓN", "OBSERVACIONES"],
    responsible: "Responsable de Área de Formación",
  },
  firstHeaderHeight: 132,
  continuationHeaderHeight: 0,
  tableHeaderHeight: 30,
  minimumRowHeight: 24,
  lineHeight: 8.5,
  responsibleHeight: 44,
} as const;
