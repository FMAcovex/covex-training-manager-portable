import { getAnnexRepository } from "@/annexes/annex-repositories";
import { AnnexIIIService } from "@/annexes/annex-iii-service";
import { getPeopleRepository } from "@/server/people-repositories";
import { getSessionRepository } from "@/server/session-repositories";
import { getTrainingRepository } from "@/server/training-repositories";
import { AnnexIVService } from "@/annexes/annex-iv-service";
import { AnnexVService } from "@/annexes/annex-v-service";
import { getAnnualPlanService } from "@/annual-plan/annual-plan-services";
import { getPersonHistoryService } from "@/history/person-history-services";

let service: AnnexIIIService | undefined;
export function getAnnexIIIService() {
  service ??= new AnnexIIIService(getTrainingRepository(), getSessionRepository(), getPeopleRepository(), getAnnexRepository());
  return service;
}

let annexIVService: AnnexIVService | undefined;
export function getAnnexIVService() { annexIVService ??= new AnnexIVService(getAnnualPlanService(), getAnnexRepository()); return annexIVService; }

let annexVService: AnnexVService | undefined;
export function getAnnexVService() { annexVService ??= new AnnexVService(getPersonHistoryService(), getAnnexRepository()); return annexVService; }
