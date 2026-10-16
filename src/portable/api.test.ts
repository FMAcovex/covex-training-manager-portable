import { afterEach, describe, expect, it, vi } from "vitest";
import { delegatedGraphToken } from "./api";

afterEach(() => vi.unstubAllEnvs());

describe("H10A/H10B API boundary", () => {
  it("disables bearer-only H10A repositories in corporate portable mode", () => {
    vi.stubEnv("PERSISTENCE_PROVIDER", "portable-sharepoint");
    const request = new Request("http://127.0.0.1:43110/api/portable/trainings", { headers: { Authorization: `Bearer ${"synthetic".repeat(10)}` } });
    expect(() => delegatedGraphToken(request)).toThrow("prototipo H10A");
  });
});
