import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));

vi.mock("@/auth/current-user", async (original) => ({
  ...(await original()),
  getCurrentUser: mocks.getCurrentUser,
}));

import { AuthenticationError } from "@/auth/request-user";
import { getApiUser } from "./api-user";

describe("getApiUser", () => {
  it("devuelve el usuario cuando la identidad es válida", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce({
      id: "user-1",
      displayName: "Usuario",
      role: "USER",
    });

    await expect(getApiUser()).resolves.toEqual({
      user: { id: "user-1", displayName: "Usuario", role: "USER" },
    });
  });

  it("convierte identidad ausente en 401", async () => {
    mocks.getCurrentUser.mockRejectedValueOnce(
      new AuthenticationError("Identidad corporativa no disponible", 401),
    );

    const result = await getApiUser();
    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(401);
      await expect(result.response.json()).resolves.toEqual({
        error: "Identidad corporativa no disponible",
      });
    }
  });

  it("convierte usuario no autorizado en 403", async () => {
    mocks.getCurrentUser.mockRejectedValueOnce(
      new AuthenticationError("Usuario no registrado en COVEX Training Manager", 403),
    );

    const result = await getApiUser();
    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(403);
      await expect(result.response.json()).resolves.toEqual({
        error: "Usuario no registrado en COVEX Training Manager",
      });
    }
  });

  it("no oculta errores inesperados", async () => {
    mocks.getCurrentUser.mockRejectedValueOnce(new Error("fallo inesperado"));
    await expect(getApiUser()).rejects.toThrow("fallo inesperado");
  });
});
