export default function AccessDeniedPage() {
  return (
    <main className="standalone-page">
      <section className="card">
        <h1>Acceso no disponible</h1>
        <p>
          La identidad corporativa se ha reconocido, pero este usuario no tiene un perfil activo en COVEX Training Manager.
        </p>
        <p className="muted">
          Solicite al administrador de la aplicación que revise el usuario y el rol asignado.
        </p>
      </section>
    </main>
  );
}
