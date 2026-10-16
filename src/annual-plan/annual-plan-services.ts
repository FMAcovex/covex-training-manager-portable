import { AnnualPlanService } from "@/annual-plan/annual-plan-service";
import { getPeopleRepository } from "@/server/people-repositories";
import { getSessionRepository } from "@/server/session-repositories";
import { getTrainingRepository } from "@/server/training-repositories";

let service: AnnualPlanService | undefined;
export function getAnnualPlanService() { service ??= new AnnualPlanService(getTrainingRepository(), getSessionRepository(), getPeopleRepository()); return service; }
