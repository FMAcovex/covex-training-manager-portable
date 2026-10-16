import { readRuntimeConfiguration } from "@/config/runtime";
import PortableLogin from "./portable-login";

export default function AccessDeniedPage() {
  const portable = readRuntimeConfiguration().authMode === "portable-entra";
  return (
    <main className="standalone-page">
      {process.env.PORTABLE_DESKTOP_MODE === "corporate" && <aside className="portable-notice">Piloto Microsoft 365 — NO-GO para datos corporativos y uso GMP hasta validación de IT y Calidad.</aside>}
      <section className="card">
        <h1>Acceso no disponible</h1>
        {portable ? <PortableLogin /> : <><p>
          La identidad corporativa se ha reconocido, pero este usuario no tiene un perfil activo en COVEX Training Manager.
        </p>
        <p className="muted">
          Solicite al administrador de la aplicación que revise el usuario y el rol asignado.
        </p></>}
      </section>
    </main>
  );
}
