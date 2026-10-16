import { describe, expect, it } from "vitest";
import { PortableConfigurationError, readPortablePublicConfiguration, readPortableServerConfiguration } from "./config";

describe("portable configuration", () => {
  it("accepts only public Entra identifiers and a loopback redirect", () => {
    expect(readPortablePublicConfiguration({
      PORTABLE_ENTRA_TENANT_ID: "11111111-1111-1111-1111-111111111111",
      PORTABLE_ENTRA_CLIENT_ID: "22222222-2222-2222-2222-222222222222",
      PORTABLE_ENTRA_REDIRECT_URI: "http://127.0.0.1:43110/portable-poc",
    } as NodeJS.ProcessEnv)).toEqual({
      tenantId: "11111111-1111-1111-1111-111111111111",
      clientId: "22222222-2222-2222-2222-222222222222",
      redirectUri: "http://127.0.0.1:43110/portable-poc",
    });
  });

  it("fails clearly when SharePoint identifiers are missing", () => {
    expect(() => readPortableServerConfiguration({} as NodeJS.ProcessEnv)).toThrow(PortableConfigurationError);
  });

  it("fails clearly when runtime Entra identifiers are missing", () => {
    expect(() => readPortablePublicConfiguration({} as NodeJS.ProcessEnv)).toThrow(PortableConfigurationError);
  });
});
