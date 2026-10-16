import type { AuditEventRepository } from "@/administration/audit-repository";
import { GraphPortableEntityStore, type PortableEntityStore } from "@/portable/sharepoint/entity-store";
import { PortableAuditEventRepository, PortablePeopleRepository, PortableSessionRepository, PortableTrainingRepository } from "@/portable/sharepoint/repositories";
import type { PeopleRepository } from "@/server/people-repository";
import type { SessionRepository } from "@/server/session-repository";
import type { TrainingRepository } from "@/server/training-repository";
import type { UserProfileRepository } from "@/administration/user-profile-repository";
import type { CatalogAdminRepository } from "@/administration/catalog-repository";
import type { AnnexRepository } from "@/annexes/annex-repository";
import type { TrainerRepository } from "@/server/trainer-repository";
import type { DocumentControlRepository } from "@/document-control/repository";
import { PortableAnnexRepository, PortableCatalogAdminRepository, PortableDocumentControlRepository, PortableTrainerRepository, PortableUserProfileRepository } from "@/portable/sharepoint/repositories-extra";
import { PortableWriteCoordinator } from "./write-coordinator";

type PortableProvider = {
  store: PortableEntityStore;
  audit: AuditEventRepository;
  people: PeopleRepository;
  trainings: TrainingRepository;
  sessions: SessionRepository;
  users: UserProfileRepository;
  catalogs: CatalogAdminRepository;
  annexes: AnnexRepository;
  trainers: TrainerRepository;
  documentControl: DocumentControlRepository;
  writes: PortableWriteCoordinator;
};

const globalPortable = globalThis as unknown as { covexPortableProvider?: PortableProvider };

export function createPortableProvider(store: PortableEntityStore = new GraphPortableEntityStore()): PortableProvider {
  const writes = new PortableWriteCoordinator(store);
  const tracked = writes.store;
  const audit = writes.guard<AuditEventRepository>(new PortableAuditEventRepository(tracked), "audit", ["append"]);
  const people = writes.guard<PeopleRepository>(new PortablePeopleRepository(tracked, audit), "people", ["create", "update", "rollbackCreated", "activate", "deactivate"]);
  const trainings = writes.guard<TrainingRepository>(new PortableTrainingRepository(tracked, audit, () => writes.operationKind === "TRAINING_IMPORT"), "trainings", ["create", "update", "closeDocumentary", "reopenDocumentary"]);
  const sessions = writes.guard<SessionRepository>(new PortableSessionRepository(tracked, trainings, people, audit), "sessions", ["create", "update", "finalize", "markNotExecuted", "reopen", "importHistorical"]);
  const users = writes.guard<UserProfileRepository>(new PortableUserProfileRepository(tracked, audit), "users", ["create", "update"]);
  const catalogs = writes.guard<CatalogAdminRepository>(new PortableCatalogAdminRepository(tracked, audit, trainings, people), "catalogs", ["create", "update"]);
  const annexes = writes.guard<AnnexRepository>(new PortableAnnexRepository(tracked, audit), "annexes", ["registerTemplateVersion", "updateTemplateVersion", "createGeneratedDocument"]);
  const trainers = writes.guard<TrainerRepository>(new PortableTrainerRepository(tracked, people, audit, writes), "trainers", ["createQualification", "createQualifiedTrainer", "updateQualification", "retireQualification", "annulQualification", "importQualifications", "addDocument", "removeDocument"]);
  const documentControl = writes.guard<DocumentControlRepository>(new PortableDocumentControlRepository(tracked, audit, writes), "documentControl", ["upsert", "addAttachment", "removeAttachment"]);
  return { store: tracked, audit, people, trainings, sessions, users, catalogs, annexes, trainers, documentControl, writes };
}

export function getPortableProvider() {
  globalPortable.covexPortableProvider ??= createPortableProvider();
  return globalPortable.covexPortableProvider;
}
