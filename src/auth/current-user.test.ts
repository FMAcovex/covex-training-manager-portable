import { describe, expect, it } from "vitest";
import { canAccessAdministration, canCloseSession, canCloseTraining, canCreateSession, canCreateTraining, canEditSession, canEditTraining, canGenerateAnnexIII, canGenerateAnnexIV, canGenerateAnnexV, canManagePeople, canReadAnnualPlan, canReadDocumentControl, canReadPersonHistory, canReopenSession, canUpdateDocumentControl } from "./current-user";

describe("autorización de Administración", () => {
  it("permite exclusivamente a ADMIN", () => {
    expect(canAccessAdministration({ id: "a", displayName: "Admin", role: "ADMIN" })).toBe(true);
    expect(canAccessAdministration({ id: "u", displayName: "User", role: "USER" })).toBe(false);
    expect(canAccessAdministration({ id: "r", displayName: "Responsible", role: "RESPONSIBLE" })).toBe(false);
  });
});

describe("autorización de Personal", () => {
  it("solo permite gestión a ADMIN", () => {
    expect(canManagePeople({ id: "1", displayName: "Demo", role: "ADMIN" })).toBe(true);
    expect(canManagePeople({ id: "2", displayName: "Demo", role: "USER" })).toBe(false);
    expect(canManagePeople({ id: "3", displayName: "Demo", role: "RESPONSIBLE" })).toBe(false);
  });
});

describe("autorización del Anexo III", () => {
  it.each(["USER", "RESPONSIBLE", "ADMIN"] as const)("permite generar a %s", (role) => {
    expect(canGenerateAnnexIII({ id: role, displayName: "Usuario Ficticio", role })).toBe(true);
  });
});

describe("autorización de Plan, historial y Anexos IV/V", () => {
  const actor = (role: "USER" | "RESPONSIBLE" | "ADMIN") => ({ id: role, displayName: "Ficticio", role });
  it.each(["USER", "RESPONSIBLE", "ADMIN"] as const)("permite leer el Plan a %s", (role) => expect(canReadAnnualPlan(actor(role))).toBe(true));
  it("reserva historial e IV/V a RESPONSIBLE y ADMIN", () => {
    expect(canReadPersonHistory(actor("USER"))).toBe(false); expect(canGenerateAnnexIV(actor("USER"))).toBe(false); expect(canGenerateAnnexV(actor("USER"))).toBe(false);
    for (const role of ["RESPONSIBLE", "ADMIN"] as const) { expect(canReadPersonHistory(actor(role))).toBe(true); expect(canGenerateAnnexIV(actor(role))).toBe(true); expect(canGenerateAnnexV(actor(role))).toBe(true); }
  });
});

describe("autorización de Sesiones", () => {
  const user = { id: "1", displayName: "Demo", role: "USER" as const };
  const responsible = { id: "2", displayName: "Demo", role: "RESPONSIBLE" as const };
  const admin = { id: "3", displayName: "Demo", role: "ADMIN" as const };
  it("permite crear a todos los perfiles", () => expect([user, responsible, admin].every(canCreateSession)).toBe(true));
  it("solo RESPONSIBLE y ADMIN pueden cerrar", () => { expect(canCloseSession(user)).toBe(false); expect(canCloseSession(responsible)).toBe(true); expect(canCloseSession(admin)).toBe(true); });
  it("solo RESPONSIBLE y ADMIN pueden editar una sesión pendiente", () => { expect(canEditSession(user, "PENDING")).toBe(false); expect(canEditSession(responsible, "PENDING")).toBe(true); expect(canEditSession(admin, "PENDING")).toBe(true); });
  it("RESPONSIBLE y ADMIN pueden editar estados cerrados", () => { expect(canEditSession(user, "EXECUTED")).toBe(false); expect(canEditSession(responsible, "NOT_EXECUTED")).toBe(true); expect(canEditSession(admin, "EXECUTED")).toBe(true); });
  it("RESPONSIBLE y ADMIN pueden reabrir sesiones", () => { expect(canReopenSession(user)).toBe(false); expect(canReopenSession(responsible)).toBe(true); expect(canReopenSession(admin)).toBe(true); });
});

describe("autorización de control documental", () => {
  const actor = (role: "USER" | "RESPONSIBLE" | "ADMIN") => ({ id: role, displayName: "Ficticio", role });
  it("reserva consulta y actualización a RESPONSIBLE y ADMIN", () => {
    expect(canReadDocumentControl(actor("USER"))).toBe(false); expect(canUpdateDocumentControl(actor("USER"))).toBe(false);
    for (const role of ["RESPONSIBLE", "ADMIN"] as const) { expect(canReadDocumentControl(actor(role))).toBe(true); expect(canUpdateDocumentControl(actor(role))).toBe(true); }
  });
});

describe("autorización de Formaciones", () => {
  const user = { id: "1", displayName: "Demo", role: "USER" as const };
  const responsible = { id: "2", displayName: "Demo", role: "RESPONSIBLE" as const };
  const admin = { id: "3", displayName: "Demo", role: "ADMIN" as const };

  it("permite crear a los tres perfiles", () => {
    expect(canCreateTraining(user)).toBe(true);
    expect(canCreateTraining(responsible)).toBe(true);
    expect(canCreateTraining(admin)).toBe(true);
  });

  it("permite editar a RESPONSIBLE y ADMIN, pero no a USER", () => {
    expect(canEditTraining(user)).toBe(false);
    expect(canEditTraining(responsible)).toBe(true);
    expect(canEditTraining(admin)).toBe(true);
  });

  it("permite cierre documental a RESPONSIBLE y ADMIN", () => {
    expect(canCloseTraining(user)).toBe(false);
    expect(canCloseTraining(responsible)).toBe(true);
    expect(canCloseTraining(admin)).toBe(true);
  });
});
