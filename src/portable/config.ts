import { z } from "zod";

const requiredText = z.string().trim().min(1).max(500);

const serverSchema = z.object({
  siteId: requiredText,
  trainingsListId: requiredText,
  documentDriveId: requiredText,
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
    trainingsListId: env.PORTABLE_SHAREPOINT_TRAININGS_LIST_ID,
    documentDriveId: env.PORTABLE_SHAREPOINT_DOCUMENT_DRIVE_ID,
  });
  if (!parsed.success) {
    throw new PortableConfigurationError(
      "Falta configuración de SharePoint para el prototipo portable. Revisa PORTABLE_SHAREPOINT_SITE_ID, PORTABLE_SHAREPOINT_TRAININGS_LIST_ID y PORTABLE_SHAREPOINT_DOCUMENT_DRIVE_ID.",
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
      "Falta configuración pública de Microsoft Entra. Revisa NEXT_PUBLIC_ENTRA_TENANT_ID, NEXT_PUBLIC_ENTRA_CLIENT_ID y NEXT_PUBLIC_ENTRA_REDIRECT_URI.",
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
