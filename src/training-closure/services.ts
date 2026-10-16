import { getDocumentControlRepository } from "@/document-control/services";
import { getSessionRepository } from "@/server/session-repositories";
import { getTrainingRepository } from "@/server/training-repositories";
import { TrainingClosureService } from "./service";

export function getTrainingClosureService() {
  return new TrainingClosureService(
    getTrainingRepository(),
    getSessionRepository(),
    getDocumentControlRepository(),
  );
}
