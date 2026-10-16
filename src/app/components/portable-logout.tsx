"use client";

export default function PortableLogout() {
  async function logout() {
    await fetch("/api/portable/session", { method: "DELETE", credentials: "same-origin" });
    window.location.assign("/acceso-denegado");
  }
  return <button type="button" className="button-link" onClick={() => void logout()}>Cerrar sesión</button>;
}
