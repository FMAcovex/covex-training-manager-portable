import { describe, expect, it } from "vitest";
import { readRuntimeConfiguration, RuntimeConfigurationError, shouldUsePersistentRepositories } from "./runtime";

describe("configuración de runtime", () => {
  it("mantiene desarrollo en demo y memoria por defecto", () => {
    const env = { APP_ENV: "development", AUTH_MODE: "demo" } as NodeJS.ProcessEnv;
    expect(readRuntimeConfiguration(env)).toMatchObject({
      production: false,
      authMode: "demo",
      persistenceProvider: "demo",
      databaseConfigured: false,
      sharePoint: { enabled: false },
    });
    expect(shouldUsePersistentRepositories(env)).toBe(false);
  });

  it("permite producción portable sin PostgreSQL y prohíbe demo", () => {
    const env = {
      APP_ENV: "production",
      AUTH_MODE: "portable-entra",
      PERSISTENCE_PROVIDER: "portable-sharepoint",
      PORTABLE_ENTRA_TENANT_ID: "11111111-1111-1111-1111-111111111111",
      PORTABLE_ENTRA_CLIENT_ID: "22222222-2222-2222-2222-222222222222",
      PORTABLE_ENTRA_REDIRECT_URI: "http://127.0.0.1:43110",
      PORTABLE_SHAREPOINT_SITE_ID: "site",
      PORTABLE_SHAREPOINT_DOCUMENT_DRIVE_ID: "drive",
      PORTABLE_SHAREPOINT_LIST_PREFIX: "COVEX",
    } as NodeJS.ProcessEnv;
    expect(readRuntimeConfiguration(env)).toMatchObject({
      production: true,
      authMode: "portable-entra",
      persistenceProvider: "portable-sharepoint",
      databaseConfigured: false,
    });
    expect(shouldUsePersistentRepositories(env)).toBe(false);
  });

  it("exige PostgreSQL y autenticación App Service en producción", () => {
    expect(() => readRuntimeConfiguration({ APP_ENV: "production", AUTH_MODE: "app-service" } as NodeJS.ProcessEnv))
      .toThrowError(RuntimeConfigurationError);
    expect(() => readRuntimeConfiguration({
      APP_ENV: "production",
      AUTH_MODE: "demo",
      DATABASE_URL: "postgresql://example",
    } as NodeJS.ProcessEnv)).toThrow("AUTH_MODE=demo no está permitido en producción");
  });

  it("acepta configuración productiva completa", () => {
    const env = {
      APP_ENV: "production",
      AUTH_MODE: "app-service",
      DATABASE_URL: "postgresql://example",
    } as NodeJS.ProcessEnv;
    expect(readRuntimeConfiguration(env)).toMatchObject({
      production: true,
      authMode: "app-service",
      databaseConfigured: true,
    });
    expect(shouldUsePersistentRepositories(env)).toBe(true);
  });

  it("detecta Azure App Service aunque APP_ENV no esté definido", () => {
    expect(readRuntimeConfiguration({
      WEBSITE_INSTANCE_ID: "instance",
      AUTH_MODE: "app-service",
      DATABASE_URL: "postgresql://example",
    } as NodeJS.ProcessEnv).production).toBe(true);
  });

  it("valida configuración opcional de SharePoint", () => {
    expect(() => readRuntimeConfiguration({
      APP_ENV: "development",
      AUTH_MODE: "demo",
      SHAREPOINT_ENABLED: "true",
    } as NodeJS.ProcessEnv)).toThrow("SHAREPOINT_SITE_ID");

    expect(readRuntimeConfiguration({
      APP_ENV: "development",
      AUTH_MODE: "demo",
      SHAREPOINT_ENABLED: "true",
      SHAREPOINT_SITE_ID: "site",
      SHAREPOINT_DRIVE_ID: "drive",
    } as NodeJS.ProcessEnv).sharePoint).toEqual({
      enabled: true,
      siteId: "site",
      driveId: "drive",
    });
  });
});

describe("configuración de servidor privado", () => {
  const env = { APP_ENV: "production", AUTH_MODE: "entra-proxy", DATABASE_URL: "postgresql://test", ENTRA_TENANT_ID: "11111111-1111-1111-1111-111111111111", ENTRA_CLIENT_ID: "22222222-2222-2222-2222-222222222222", AUTH_PROXY_SECRET: "a".repeat(64) };
  it("permite Entra con persistencia obligatoria", () => {
    expect(readRuntimeConfiguration(env).authMode).toBe("entra-proxy");
    expect(shouldUsePersistentRepositories(env)).toBe(true);
  });
  it.each(["DATABASE_URL", "ENTRA_TENANT_ID", "ENTRA_CLIENT_ID", "AUTH_PROXY_SECRET"])("rechaza %s ausente", name => {
    expect(() => readRuntimeConfiguration({ ...env, [name]: "" })).toThrow(RuntimeConfigurationError);
  });
});
