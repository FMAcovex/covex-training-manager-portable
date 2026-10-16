export type AuthMode = "demo" | "app-service" | "entra-proxy";

export type RuntimeConfiguration = {
  production: boolean;
  authMode: AuthMode;
  databaseConfigured: boolean;
  sharePoint: {
    enabled: boolean;
    siteId?: string;
    driveId?: string;
  };
};

export class RuntimeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeConfigurationError";
  }
}

function enabled(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() === "true";
}

export function readRuntimeConfiguration(env: NodeJS.ProcessEnv = process.env): RuntimeConfiguration {
  const production = env.APP_ENV?.trim().toLocaleLowerCase() === "production" || Boolean(env.WEBSITE_INSTANCE_ID);
  const rawAuthMode = env.AUTH_MODE?.trim().toLocaleLowerCase() || (production ? "app-service" : "demo");
  if (rawAuthMode !== "demo" && rawAuthMode !== "app-service" && rawAuthMode !== "entra-proxy") {
    throw new RuntimeConfigurationError("AUTH_MODE debe ser demo, app-service o entra-proxy");
  }

  const sharePointEnabled = enabled(env.SHAREPOINT_ENABLED);
  const errors: string[] = [];
  if (production && !env.DATABASE_URL?.trim()) errors.push("DATABASE_URL es obligatoria en producción");
  if (production && rawAuthMode === "demo") errors.push("AUTH_MODE=demo no está permitido en producción");
  if (rawAuthMode === "entra-proxy") {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const name of ["ENTRA_TENANT_ID", "ENTRA_CLIENT_ID"]) {
      if (!uuid.test(env[name] ?? "")) errors.push(`${name} debe ser un UUID corporativo`);
    }
    if (!/^[0-9a-f]{64}$/.test(env.AUTH_PROXY_SECRET ?? "")) errors.push("AUTH_PROXY_SECRET debe contener 64 caracteres hexadecimales aleatorios");
  }
  if (sharePointEnabled && !env.SHAREPOINT_SITE_ID?.trim()) errors.push("SHAREPOINT_SITE_ID es obligatorio cuando SHAREPOINT_ENABLED=true");
  if (sharePointEnabled && !env.SHAREPOINT_DRIVE_ID?.trim()) errors.push("SHAREPOINT_DRIVE_ID es obligatorio cuando SHAREPOINT_ENABLED=true");

  if (errors.length) throw new RuntimeConfigurationError(errors.join("; "));

  return {
    production,
    authMode: rawAuthMode,
    databaseConfigured: Boolean(env.DATABASE_URL?.trim()),
    sharePoint: {
      enabled: sharePointEnabled,
      siteId: env.SHAREPOINT_SITE_ID?.trim() || undefined,
      driveId: env.SHAREPOINT_DRIVE_ID?.trim() || undefined,
    },
  };
}

export function shouldUsePersistentRepositories(env: NodeJS.ProcessEnv = process.env) {
  const config = readRuntimeConfiguration(env);
  return config.production || config.databaseConfigured;
}
