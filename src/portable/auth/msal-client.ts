"use client";

import {
  BrowserCacheLocation,
  InteractionRequiredAuthError,
  LogLevel,
  PublicClientApplication,
  type AccountInfo,
} from "@azure/msal-browser";
import type { PortableClientConfiguration } from "@/portable/config";

export const PORTABLE_GRAPH_SCOPES = ["User.Read", "Sites.ReadWrite.All", "Files.ReadWrite.All"];

let application: PublicClientApplication | undefined;

async function getApplication() {
  if (application) return application;
  const response = await fetch("/api/portable/config", { cache: "no-store" });
  const body = await response.json().catch(() => ({})) as PortableClientConfiguration & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "No se pudo leer la configuración pública de Microsoft Entra.");
  const config = body;
  application = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri: config.redirectUri,
    },
    cache: { cacheLocation: BrowserCacheLocation.SessionStorage },
    system: {
      loggerOptions: {
        piiLoggingEnabled: false,
        logLevel: LogLevel.Error,
        loggerCallback: () => undefined,
      },
    },
  });
  await application.initialize();
  return application;
}

async function account(client: PublicClientApplication): Promise<AccountInfo> {
  const existing = client.getActiveAccount() ?? client.getAllAccounts()[0];
  if (existing) return existing;
  const result = await client.loginPopup({ scopes: PORTABLE_GRAPH_SCOPES, prompt: "select_account" });
  if (!result.account) throw new Error("Microsoft Entra no devolvió una cuenta autenticada.");
  client.setActiveAccount(result.account);
  return result.account;
}

export async function acquirePortableGraphToken() {
  const client = await getApplication();
  const activeAccount = await account(client);
  try {
    const result = await client.acquireTokenSilent({ account: activeAccount, scopes: PORTABLE_GRAPH_SCOPES });
    return { accessToken: result.accessToken, account: activeAccount };
  } catch (error) {
    if (!(error instanceof InteractionRequiredAuthError)) throw error;
    const result = await client.acquireTokenPopup({ account: activeAccount, scopes: PORTABLE_GRAPH_SCOPES });
    return { accessToken: result.accessToken, account: result.account ?? activeAccount };
  }
}
