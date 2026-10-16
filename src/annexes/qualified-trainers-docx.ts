import { COVEX_LOGO_TEST } from "@/annexes/templates/covex-logo-test";
import type { TrainerQualification } from "@/domain/trainer";

type ZipEntry = { name: string; data: Buffer | string };
type CellOptions = {
  width: number;
  align?: "left" | "center" | "right";
  fill?: string;
  gridSpan?: number;
  vMerge?: "restart" | "continue";
  size?: number;
  bold?: boolean;
  topBorder?: boolean;
  bottomBorder?: boolean;
  keepNext?: boolean;
};
type RowOptions = { header?: boolean; cantSplit?: boolean; minHeight?: number };

const xmlEscape = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const uint16 = (value: number) => {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
};

const uint32 = (value: number) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
};

function crc32(buffer: Buffer) {
  let current = 0xffffffff;
  for (const byte of buffer) {
    current ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      current = (current >>> 1) ^ ((current & 1) ? 0xedb88320 : 0);
    }
  }
  return (current ^ 0xffffffff) >>> 0;
}

function storedZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, "utf8");
    const checksum = crc32(data);
    const local = Buffer.concat([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(data.length),
      uint32(data.length),
      uint16(name.length),
      uint16(0),
      name,
      data,
    ]);
    localParts.push(local);

    centralParts.push(Buffer.concat([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(checksum),
      uint32(data.length),
      uint32(data.length),
      uint16(name.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      name,
    ]));
    offset += local.length;
  }

  const central = Buffer.concat(centralParts);
  const end = Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(central.length),
    uint32(offset),
    uint16(0),
  ]);
  return Buffer.concat([...localParts, central, end]);
}

function textXml(value: string) {
  return value.split(/\r?\n/).map((line, index) =>
    `${index ? "<w:br/>" : ""}<w:t xml:space="preserve">${xmlEscape(line)}</w:t>`
  ).join("");
}

function runXml(value: string, options: { size?: number; bold?: boolean; italic?: boolean; underline?: boolean } = {}) {
  const size = options.size ?? 22;
  return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${options.bold ? "<w:b/><w:bCs/>" : ""}${options.italic ? "<w:i/><w:iCs/>" : ""}${options.underline ? '<w:u w:val="single"/>' : ""}</w:rPr>${textXml(value)}</w:r>`;
}

function paragraphXml(
  value: string,
  options: {
    align?: "left" | "center" | "right";
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    before?: number;
    after?: number;
    borderTop?: boolean;
    borderBottom?: boolean;
    keepNext?: boolean;
  } = {},
) {
  const align = options.align ?? "left";
  const border = options.borderTop || options.borderBottom
    ? `<w:pBdr>${options.borderTop ? '<w:top w:val="single" w:sz="4" w:space="1" w:color="000000"/>' : ""}${options.borderBottom ? '<w:bottom w:val="single" w:sz="4" w:space="1" w:color="000000"/>' : ""}</w:pBdr>`
    : "";
  return `<w:p><w:pPr><w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 0}" w:line="240" w:lineRule="auto"/><w:jc w:val="${align}"/>${options.keepNext ? "<w:keepNext/>" : ""}${border}</w:pPr>${runXml(value, options)}</w:p>`;
}

function imageXml(relationshipId: string, width: number, height: number, drawingId: number) {
  return `<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${drawingId}" name="COVEX logo"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="covex-logo.jpg"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function imageParagraphXml(relationshipId: string, width: number, height: number, drawingId: number, align: "left" | "center" = "center") {
  return `<w:p><w:pPr><w:jc w:val="${align}"/></w:pPr>${imageXml(relationshipId, width, height, drawingId)}</w:p>`;
}

function cellBorders(top: boolean, bottom: boolean) {
  return `<w:tcBorders>${top ? '<w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>' : ""}<w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/>${bottom ? '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>' : ""}<w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/></w:tcBorders>`;
}

function cellXml(value: string, options: CellOptions) {
  const align = options.align ?? "left";
  return `<w:tc><w:tcPr><w:tcW w:w="${options.width}" w:type="pct"/>${options.gridSpan ? `<w:gridSpan w:val="${options.gridSpan}"/>` : ""}${options.vMerge ? `<w:vMerge${options.vMerge === "restart" ? ' w:val="restart"' : ""}/>` : ""}${options.fill ? `<w:shd w:fill="${options.fill}"/>` : ""}${cellBorders(options.topBorder ?? true, options.bottomBorder ?? true)}<w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="${align}"/>${options.keepNext ? "<w:keepNext/>" : ""}</w:pPr>${runXml(value, { size: options.size, bold: options.bold })}</w:p></w:tc>`;
}

function rowXml(cells: string[], options: RowOptions = {}) {
  return `<w:tr><w:trPr>${options.header ? "<w:tblHeader/>" : ""}${options.cantSplit ? "<w:cantSplit/>" : ""}<w:trHeight w:val="${options.minHeight ?? 624}"/><w:jc w:val="center"/></w:trPr>${cells.join("")}</w:tr>`;
}

const displayDate = (value?: string) => value ? value.split("-").reverse().join("/") : "";

function qualificationRows(rows: TrainerQualification[]) {
  const sorted = [...rows].sort((a, b) =>
    a.person.fullName.localeCompare(b.person.fullName, "es")
    || a.authorizedSubject.localeCompare(b.authorizedSubject, "es")
    || a.qualifiedFrom.localeCompare(b.qualifiedFrom)
  );
  const groups: Array<{ personId: string; rows: TrainerQualification[] }> = [];
  for (const item of sorted) {
    let group = groups.at(-1);
    if (!group || group.personId !== item.personId) {
      group = { personId: item.personId, rows: [] };
      groups.push(group);
    }
    group.rows.push(item);
  }

  return groups.flatMap((group) => {
    const count = group.rows.length;
    const evidenceRun = new Map<number, { start: number; end: number }>();
    let start = 0;
    while (start < count) {
      let end = start + 1;
      while (end < count && group.rows[end].evidence === group.rows[start].evidence) end++;
      for (let index = start; index < end; index++) evidenceRun.set(index, { start, end });
      start = end;
    }

    return group.rows.map((item, index) => {
      const first = index === 0;
      const last = index === count - 1;
      const evidence = evidenceRun.get(index)!;
      const evidenceFirst = index === evidence.start;
      const evidenceLast = index === evidence.end - 1;
      const evidenceSingle = evidence.end - evidence.start === 1;
      const personMerge = count === 1 ? undefined : first ? "restart" : "continue";
      const evidenceMerge = evidenceSingle ? undefined : evidenceFirst ? "restart" : "continue";
      const keepNext = !last;

      return rowXml([
        cellXml(first ? item.person.fullName : "", {
          width: 1270,
          align: "center",
          vMerge: personMerge,
          topBorder: first,
          bottomBorder: last,
          keepNext,
        }),
        cellXml(item.authorizedSubject, { width: 1015, keepNext }),
        cellXml(evidenceFirst ? item.evidence : "", {
          width: 1025,
          vMerge: evidenceMerge,
          topBorder: evidenceFirst,
          bottomBorder: evidenceLast,
          keepNext,
        }),
        cellXml(displayDate(item.qualifiedFrom), { width: 540, align: "center", keepNext }),
        cellXml(displayDate(item.qualifiedTo), { width: 540, align: "center", keepNext }),
        cellXml(first ? (item.person.personType === "INTERNAL" ? "INTERNO" : "EXTERNO") : "", {
          width: 610,
          align: "center",
          vMerge: personMerge,
          topBorder: first,
          bottomBorder: last,
          keepNext,
        }),
      ], { cantSplit: true });
    });
  }).join("");
}

function documentXml(rows: TrainerQualification[]) {
  const titleRow = rowXml([
    cellXml("LISTADO DE FORMADORES CUALIFICADOS", {
      width: 5000,
      align: "center",
      fill: "D9D9D9",
      gridSpan: 6,
      size: 32,
      bold: true,
    }),
  ], { header: true, cantSplit: true, minHeight: 754 });

  const headers = rowXml([
    cellXml("FORMADOR CUALIFICADO", { width: 1270, align: "center", fill: "D9D9D9", bold: true }),
    cellXml("MATERIA /\nFORMACIÓN\nAUTORIZADA", { width: 1015, align: "center", fill: "D9D9D9", bold: true }),
    cellXml("EVIDENCIA DE\nCUALIFICACIÓN", { width: 1025, align: "center", fill: "D9D9D9", bold: true }),
    cellXml("FECHA DE\nALTA", { width: 540, align: "center", fill: "D9D9D9", bold: true }),
    cellXml("FECHA DE\nBAJA", { width: 540, align: "center", fill: "D9D9D9", bold: true }),
    cellXml("INTERNO /\nEXTERNO", { width: 610, align: "center", fill: "D9D9D9", bold: true }),
  ], { header: true, cantSplit: true });

  const table = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/><w:jc w:val="center"/><w:tblCellMar><w:top w:w="55" w:type="dxa"/><w:left w:w="55" w:type="dxa"/><w:bottom w:w="55" w:type="dxa"/><w:right w:w="55" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="3440"/><w:gridCol w:w="2749"/><w:gridCol w:w="2776"/><w:gridCol w:w="1463"/><w:gridCol w:w="1463"/><w:gridCol w:w="1653"/></w:tblGrid>${titleRow}${headers}${qualificationRows(rows)}</w:tbl>`;

  const portraitSection = `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1183" w:right="907" w:bottom="1077" w:left="1077" w:header="851" w:footer="839" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
  const landscapeSection = `<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="1077" w:right="1183" w:bottom="907" w:left="1077" w:header="851" w:footer="839" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>
${paragraphXml("", { align: "center", borderTop: true })}
${paragraphXml("LISTADO DE FORMADORES", { align: "center", size: 72, bold: true, before: 2500 })}
${paragraphXml("CUALIFICADOS", { align: "center", size: 72, bold: true, before: 850 })}
${imageParagraphXml("rIdLogo", 2086945, 1095131, 1)}
${paragraphXml("Anexo III del PNT RH-00/008/02", { align: "center", size: 44, italic: true, before: 340 })}
${paragraphXml("", { align: "center", borderBottom: true, before: 1200 })}
<w:p><w:pPr>${portraitSection}</w:pPr></w:p>
${paragraphXml("")}
${table}
${paragraphXml("")}
<w:p><w:pPr><w:spacing w:before="140" w:after="120"/></w:pPr>${runXml("Aprobado por:", { size: 22, bold: true, underline: true })}</w:p>
${paragraphXml("(Nombre, Fecha y Firma)", { size: 22 })}
${paragraphXml("", { before: 900 })}
${landscapeSection}</w:body></w:document>`;
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr/></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/></w:rPr></w:style></w:styles>`;

const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:zoom w:percent="100"/><w:defaultTabStop w:val="720"/></w:settings>`;

const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:bottom w:val="single" w:sz="4" w:color="000000"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3500"/><w:gridCol w:w="10000"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="1300" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>${imageParagraphXml("rIdHeaderLogo", 998327, 523875, 2, "left")}</w:tc><w:tc><w:tcPr><w:tcW w:w="3700" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>${paragraphXml("Anexo III del PNT RH-00/008/02", { align: "right", size: 20, bold: true })}</w:tc></w:tr></w:tbl></w:hdr>`;

const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${paragraphXml("", { borderBottom: true })}<w:p><w:pPr><w:spacing w:after="0"/><w:jc w:val="right"/></w:pPr><w:fldSimple w:instr="PAGE"><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/><w:b/></w:rPr><w:t>2</w:t></w:r></w:fldSimple></w:p></w:ftr>`;

const documentRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/covex-logo.jpg"/><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;

const headerRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdHeaderLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/covex-logo.jpg"/></Relationships>`;

const rootRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

const coreProperties = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Listado de Formadores Cualificados</dc:title><dc:creator>COVEX</dc:creator><cp:lastModifiedBy>COVEX</cp:lastModifiedBy></cp:coreProperties>`;
const appProperties = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>COVEX Training Manager</Application></Properties>`;

export function renderQualifiedTrainersDocx(rows: TrainerQualification[]) {
  return storedZip([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rootRelationships },
    { name: "docProps/core.xml", data: coreProperties },
    { name: "docProps/app.xml", data: appProperties },
    { name: "word/document.xml", data: documentXml(rows) },
    { name: "word/styles.xml", data: stylesXml },
    { name: "word/settings.xml", data: settingsXml },
    { name: "word/_rels/document.xml.rels", data: documentRelationships },
    { name: "word/header1.xml", data: headerXml },
    { name: "word/footer1.xml", data: footerXml },
    { name: "word/_rels/header1.xml.rels", data: headerRelationships },
    { name: "word/media/covex-logo.jpg", data: Buffer.from(COVEX_LOGO_TEST.jpegBase64, "base64") },
  ]);
}
