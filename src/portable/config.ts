import { z } from "zod";

const requiredText = z.string().trim().min(1).max(500);

const serverSchema = z.object({
  siteId: requiredText,
  documentDriveId: requiredText,
  listPrefix: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
  trainingsListId: requiredText,
});

const clientSchema = z.object({
  tenantId: z.string().uuid(),
  clientId: z.string().uuid(),
  redirectUri: z.string().url(),
});

export class PortableConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortableConfigurationError";
  }
}

export type PortableServerConfiguration = z.infer<typeof serverSchema>;
export type PortableClientConfiguration = z.infer<typeof clientSchema>;

export function readPortableServerConfiguration(env: NodeJS.ProcessEnv = process.env): PortableServerConfiguration {
  const parsed = serverSchema.safeParse({
    siteId: env.PORTABLE_SHAREPOINT_SITE_ID,
    documentDriveId: env.PORTABLE_SHAREPOINT_DOCUMENT_DRIVE_ID,
    listPrefix: env.PORTABLE_SHAREPOINT_LIST_PREFIX,
    trainingsListId: env.PORTABLE_SHAREPOINT_TRAININGS_LIST_ID
      || (env.PORTABLE_SHAREPOINT_LIST_PREFIX ? `${env.PORTABLE_SHAREPOINT_LIST_PREFIX}-Training` : undefined),
  });
  if (!parsed.success) {
    throw new PortableConfigurationError(
      "Falta configuración de SharePoint portable. Revisa PORTABLE_SHAREPOINT_SITE_ID, PORTABLE_SHAREPOINT_DOCUMENT_DRIVE_ID y PORTABLE_SHAREPOINT_LIST_PREFIX.",
    );
  }
  return parsed.data;
}

export function readPortableClientConfiguration(input: {
  tenantId?: string;
  clientId?: string;
  redirectUri?: string;
}): PortableClientConfiguration {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    throw new PortableConfigurationError(
      "Falta configuración pública de Microsoft Entra. Revisa PORTABLE_ENTRA_TENANT_ID, PORTABLE_ENTRA_CLIENT_ID y PORTABLE_ENTRA_REDIRECT_URI.",
    );
  }
  return parsed.data;
}

export function readPortablePublicConfiguration(env: NodeJS.ProcessEnv = process.env) {
  return readPortableClientConfiguration({
    tenantId: env.PORTABLE_ENTRA_TENANT_ID,
    clientId: env.PORTABLE_ENTRA_CLIENT_ID,
    redirectUri: env.PORTABLE_ENTRA_REDIRECT_URI,
  });
}
