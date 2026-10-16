import { describe, expect, it } from "vitest";
import { formatDateEs, formatDateTimeEs } from "./format";

describe("formatos de fecha en español", () => {
  it("muestra fechas ISO como DD/MM/AAAA sin desplazamiento horario", () => {
    expect(formatDateEs("2026-10-02")).toBe("02/10/2026");
  });

  it("muestra vacío como guion", () => {
    expect(formatDateEs(undefined)).toBe("—");
    expect(formatDateTimeEs(null)).toBe("—");
  });

  it("formatea fecha y hora con convención española", () => {
    expect(formatDateTimeEs("2026-10-02T12:30:00.000Z")).toContain("02/10/2026");
  });
});
