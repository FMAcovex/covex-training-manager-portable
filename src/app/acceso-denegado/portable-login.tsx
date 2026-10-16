"use client";

import { useState } from "react";
import { establishPortableSession } from "@/portable/auth/msal-client";

export default function PortableLogin() {
  const [message, setMessage] = useState("Identifícate con la cuenta corporativa autorizada por IT.");
  const [busy, setBusy] = useState(false);
  async function login() {
    setBusy(true);
    try {
      await establishPortableSession();
      window.location.assign("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
      setBusy(false);
    }
  }
  return <>
    <p>{message}</p>
    <button type="button" onClick={() => void login()} disabled={busy}>{busy ? "Conectando…" : "Iniciar sesión con Microsoft Entra"}</button>
    <p className="muted">La edición portable no permite autenticación demo ni almacena el token en disco.</p>
  </>;
}
