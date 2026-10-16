import { TrainingIntegrityService } from "@/integrity/training-integrity-service";
import { getPeopleRepository } from "@/server/people-repositories";
import { getSessionRepository } from "@/server/session-repositories";
import { getTrainingRepository } from "@/server/training-repositories";

let service: TrainingIntegrityService | undefined;

export function getTrainingIntegrityService() {
  service ??= new TrainingIntegrityService(
    getTrainingRepository(),
    getSessionRepository(),
    getPeopleRepository(),
  );
  return service;
}
