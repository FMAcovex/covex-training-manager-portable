import Link from "next/link";
import AppShell from "./app-shell";
import { AppIcon } from "@/app/components/icons";
import { DashboardSection, StatCard, StatusBadge } from "@/app/components/ui";
import { calculateTrainingStatus, type TrainingSession } from "@/domain/training-session";
import { getPeopleRepository } from "@/server/people-repositories";
import { getSessionRepository } from "@/server/session-repositories";
import { getTrainingRepository } from "@/server/training-repositories";
import { getPageUser } from "@/auth/page-user";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

export default async function Home() {
  // Redirect unauthenticated portable users before querying protected repositories.
  await getPageUser();
  const [trainings, sessions, people] = await Promise.all([
    getTrainingRepository().list(),
    getSessionRepository().listAll(),
    getPeopleRepository().list(),
  ]);

  const sessionsByTraining = new Map<string, TrainingSession[]>();
  for (const session of sessions) {
    const list = sessionsByTraining.get(session.trainingId) ?? [];
    list.push(session);
    sessionsByTraining.set(session.trainingId, list);
  }

  const statusByTraining = new Map(
    trainings.map((training) => [
      training.id,
      calculateTrainingStatus(sessionsByTraining.get(training.id) ?? []),
    ]),
  );

  const activeTrainings = trainings.filter((training) => statusByTraining.get(training.id) === "PENDING");
  const completedTrainings = trainings.filter((training) => statusByTraining.get(training.id) === "EXECUTED");
  const pendingSessions = sessions
    .filter((session) => session.executionStatus === "PENDING")
    .sort((left, right) => left.plannedDate.localeCompare(right.plannedDate));
  const trainingsWithoutSessions = trainings.filter((training) => (sessionsByTraining.get(training.id)?.length ?? 0) === 0);
  const pendingTotal = pendingSessions.length + trainingsWithoutSessions.length;

  const trainingById = new Map(trainings.map((training) => [training.id, training]));
  const personById = new Map(people.map((person) => [person.id, person]));

  const pendingItems = [
    ...pendingSessions.map((session) => ({
      id: `session-${session.id}`,
      title: session.code,
      detail: `${trainingById.get(session.trainingId)?.name ?? "Formación"} · ${formatDate(session.plannedDate)}`,
      href: `/sesiones/${session.id}`,
      kind: "Sesión pendiente",
    })),
    ...trainingsWithoutSessions.map((training) => ({
      id: `training-${training.id}`,
      title: training.code,
      detail: training.name,
      href: `/formaciones/${training.id}`,
      kind: "Sin sesiones",
    })),
  ].slice(0, 6);

  return (
    <AppShell active="Inicio">
      <section className="corporate-hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">COVEX · Gestión interna</span>
          <h1>Gestión de Formaciones</h1>
          <p>Gestión y seguimiento de formaciones, sesiones y evidencias de formación.</p>
          <div className="hero-actions">
            <Link className="home-primary-action" href="/formaciones/nueva">
              <span aria-hidden="true">+</span>
              Nueva formación
            </Link>
          </div>
        </div>
        <div className="hero-mark" aria-hidden="true">COVEX</div>
      </section>

      <section className="dashboard-stats" aria-label="Indicadores de formación">
        <StatCard
          label="Formaciones activas"
          value={activeTrainings.length}
          detail="Pendientes de completar"
          icon={<AppIcon name="layers" />}
        />
        <StatCard
          label="Sesiones próximas"
          value={pendingSessions.length}
          detail="Programadas y pendientes"
          icon={<AppIcon name="clock" />}
          tone="neutral"
        />
        <StatCard
          label="Pendientes"
          value={pendingTotal}
          detail="Sesiones y formaciones sin programar"
          icon={<AppIcon name="alert" />}
          tone="warning"
        />
        <StatCard
          label="Completadas"
          value={completedTrainings.length}
          detail="Formaciones ejecutadas"
          icon={<AppIcon name="check" />}
          tone="success"
        />
      </section>

      <div className="dashboard-grid">
        <DashboardSection
          title="Sesiones próximas"
          description="Sesiones pendientes ordenadas por fecha prevista."
        >
          {pendingSessions.length > 0 ? (
            <div className="table-scroll">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Formación</th>
                    <th>Sesión</th>
                    <th>Fecha</th>
                    <th>Responsable</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSessions.slice(0, 5).map((session) => {
                    const training = trainingById.get(session.trainingId);
                    const trainer = session.trainerPersonId
                      ? personById.get(session.trainerPersonId)?.fullName
                      : session.externalTrainerName;
                    return (
                      <tr key={session.id}>
                        <td>
                          {training ? (
                            <Link className="dashboard-link" href={`/formaciones/${training.id}`}>
                              <span>{training.code}</span>
                              <small>{training.name}</small>
                            </Link>
                          ) : "—"}
                        </td>
                        <td><Link className="text-link" href={`/sesiones/${session.id}`}>{session.code}</Link></td>
                        <td>{formatDate(session.plannedDate)}</td>
                        <td>{trainer ?? "—"}</td>
                        <td><StatusBadge tone="warning">Pendiente</StatusBadge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <AppIcon name="check" />
              <strong>No hay sesiones pendientes</strong>
              <span>Las próximas sesiones aparecerán aquí cuando se programen.</span>
            </div>
          )}
        </DashboardSection>

        <DashboardSection
          title="Pendientes"
          description="Elementos que requieren planificación o ejecución."
        >
          {pendingItems.length > 0 ? (
            <div className="pending-list">
              {pendingItems.map((item) => (
                <Link className="pending-item" href={item.href} key={item.id}>
                  <div className="pending-item-icon"><AppIcon name="alert" /></div>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <StatusBadge tone="warning">{item.kind}</StatusBadge>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state compact">
              <AppIcon name="check" />
              <strong>Sin pendientes operativos</strong>
            </div>
          )}
        </DashboardSection>
      </div>
    </AppShell>
  );
}
