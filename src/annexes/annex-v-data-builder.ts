import { formatSpanishDate } from "@/annexes/annex-formatting";
import type { AnnexVData, TemplateVersion } from "@/annexes/types";
import type { PersonHistory } from "@/history/types";

export class AnnexVDataBuilder {
  build(history: PersonHistory, templateVersion: TemplateVersion): AnnexVData {
    if (history.year === undefined) throw new Error("El Anexo V requiere un año concreto");
    return {
      templateVersion,
      year: history.year,
      employee: history.person.fullName,
      department: history.department,
      jobTitle: history.person.jobTitle,
      totalAttended: history.rows.length,
      rows: history.rows.map((row) => ({
        training: row.trainingName,
        date: formatSpanishDate(row.executionDate),
        type: row.trainingType,
        materialReference: row.materialReference,
        status: "ASISTE",
        result: row.result === "PASS" ? "APTO" : "NO APTO",
        renewalDate: formatSpanishDate(row.renewalDate),
        observations: row.observations,
      })),
    };
  }
}
