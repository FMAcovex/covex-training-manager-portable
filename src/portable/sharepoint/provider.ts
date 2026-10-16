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
};

const globalPortable = globalThis as unknown as { covexPortableProvider?: PortableProvider };

export function createPortableProvider(store: PortableEntityStore = new GraphPortableEntityStore()): PortableProvider {
  const audit = new PortableAuditEventRepository(store);
  const people = new PortablePeopleRepository(store, audit);
  const trainings = new PortableTrainingRepository(store, audit);
  const sessions = new PortableSessionRepository(store, trainings, people, audit);
  const users = new PortableUserProfileRepository(store, audit);
  const catalogs = new PortableCatalogAdminRepository(store, audit, trainings, people);
  const annexes = new PortableAnnexRepository(store, audit);
  const trainers = new PortableTrainerRepository(store, people, audit);
  const documentControl = new PortableDocumentControlRepository(store, audit);
  return { store, audit, people, trainings, sessions, users, catalogs, annexes, trainers, documentControl };
}

export function getPortableProvider() {
  globalPortable.covexPortableProvider ??= createPortableProvider();
  return globalPortable.covexPortableProvider;
}
