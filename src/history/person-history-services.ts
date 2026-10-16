import { PersonHistoryService } from "@/history/person-history-service";
import { getPeopleRepository } from "@/server/people-repositories";
import { getSessionRepository } from "@/server/session-repositories";
import { getTrainingRepository } from "@/server/training-repositories";

let service: PersonHistoryService | undefined;
export function getPersonHistoryService() { service ??= new PersonHistoryService(getTrainingRepository(), getSessionRepository(), getPeopleRepository()); return service; }
