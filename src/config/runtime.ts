export type AuthMode = "demo" | "app-service" | "entra-proxy" | "portable-entra";
export type PersistenceProvider = "demo" | "server-postgres" | "portable-sharepoint";

export type RuntimeConfiguration = {
  production: boolean;
  authMode: AuthMode;
  persistenceProvider: PersistenceProvider;
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
  if (rawAuthMode !== "demo" && rawAuthMode !== "app-service" && rawAuthMode !== "entra-proxy" && rawAuthMode !== "portable-entra") {
    throw new RuntimeConfigurationError("AUTH_MODE debe ser demo, app-service, entra-proxy o portable-entra");
  }

  const rawProvider = env.PERSISTENCE_PROVIDER?.trim().toLocaleLowerCase()
    || (production || env.DATABASE_URL?.trim() ? "server-postgres" : "demo");
  if (rawProvider !== "demo" && rawProvider !== "server-postgres" && rawProvider !== "portable-sharepoint") {
    throw new RuntimeConfigurationError("PERSISTENCE_PROVIDER debe ser demo, server-postgres o portable-sharepoint");
  }
  const persistenceProvider = rawProvider as PersistenceProvider;

  const sharePointEnabled = enabled(env.SHAREPOINT_ENABLED);
  const errors: string[] = [];
  if (production && persistenceProvider === "server-postgres" && !env.DATABASE_URL?.trim()) errors.push("DATABASE_URL es obligatoria en producción con server-postgres");
  if (production && rawAuthMode === "demo") errors.push("AUTH_MODE=demo no está permitido en producción");
  if (production && persistenceProvider === "demo") errors.push("PERSISTENCE_PROVIDER=demo no está permitido en producción");
  if (persistenceProvider === "portable-sharepoint" && rawAuthMode !== "portable-entra") errors.push("portable-sharepoint exige AUTH_MODE=portable-entra");
  if (rawAuthMode === "portable-entra" && persistenceProvider !== "portable-sharepoint") errors.push("AUTH_MODE=portable-entra exige PERSISTENCE_PROVIDER=portable-sharepoint");
  if (rawAuthMode === "entra-proxy") {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const name of ["ENTRA_TENANT_ID", "ENTRA_CLIENT_ID"]) {
      if (!uuid.test(env[name] ?? "")) errors.push(`${name} debe ser un UUID corporativo`);
    }
    if (!/^[0-9a-f]{64}$/.test(env.AUTH_PROXY_SECRET ?? "")) errors.push("AUTH_PROXY_SECRET debe contener 64 caracteres hexadecimales aleatorios");
  }
  if (rawAuthMode === "portable-entra") {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const name of ["PORTABLE_ENTRA_TENANT_ID", "PORTABLE_ENTRA_CLIENT_ID"]) {
      if (!uuid.test(env[name] ?? "")) errors.push(`${name} debe ser un UUID corporativo`);
    }
    try {
      const redirect = new URL(env.PORTABLE_ENTRA_REDIRECT_URI ?? "");
      if (redirect.protocol !== "http:" || redirect.hostname !== "127.0.0.1" || !redirect.port || redirect.username || redirect.password) throw new Error("loopback");
    } catch { errors.push("PORTABLE_ENTRA_REDIRECT_URI debe usar loopback 127.0.0.1"); }
    for (const name of ["PORTABLE_SHAREPOINT_SITE_ID", "PORTABLE_SHAREPOINT_DOCUMENT_DRIVE_ID", "PORTABLE_SHAREPOINT_LIST_PREFIX"]) {
      if (!env[name]?.trim()) errors.push(`${name} es obligatorio en modo portable-sharepoint`);
    }
  }
  if (sharePointEnabled && !env.SHAREPOINT_SITE_ID?.trim()) errors.push("SHAREPOINT_SITE_ID es obligatorio cuando SHAREPOINT_ENABLED=true");
  if (sharePointEnabled && !env.SHAREPOINT_DRIVE_ID?.trim()) errors.push("SHAREPOINT_DRIVE_ID es obligatorio cuando SHAREPOINT_ENABLED=true");

  if (errors.length) throw new RuntimeConfigurationError(errors.join("; "));

  return {
    production,
    authMode: rawAuthMode,
    persistenceProvider,
    databaseConfigured: Boolean(env.DATABASE_URL?.trim()),
    sharePoint: {
      enabled: sharePointEnabled,
      siteId: env.SHAREPOINT_SITE_ID?.trim() || undefined,
      driveId: env.SHAREPOINT_DRIVE_ID?.trim() || undefined,
    },
  };
}

export function shouldUsePersistentRepositories(env: NodeJS.ProcessEnv = process.env) {
  return readRuntimeConfiguration(env).persistenceProvider === "server-postgres";
}

export function shouldUsePortableSharePoint(env: NodeJS.ProcessEnv = process.env) {
  return readRuntimeConfiguration(env).persistenceProvider === "portable-sharepoint";
}
