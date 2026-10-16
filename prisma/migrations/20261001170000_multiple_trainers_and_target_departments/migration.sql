-- Allow more than one trainer per training/session and more than one target department per training.

ALTER TABLE "Training" ADD COLUMN "plannedExternalTrainerNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "TrainingSession" ADD COLUMN "externalTrainerNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "TrainingPlannedTrainer" (
  "trainingId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  CONSTRAINT "TrainingPlannedTrainer_pkey" PRIMARY KEY ("trainingId", "personId")
);

CREATE TABLE "TrainingTargetDepartment" (
  "trainingId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  CONSTRAINT "TrainingTargetDepartment_pkey" PRIMARY KEY ("trainingId", "departmentId")
);

CREATE TABLE "TrainingSessionTrainer" (
  "sessionId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  CONSTRAINT "TrainingSessionTrainer_pkey" PRIMARY KEY ("sessionId", "personId")
);

INSERT INTO "TrainingPlannedTrainer" ("trainingId", "personId")
SELECT "id", "plannedTrainerPersonId"
FROM "Training"
WHERE "plannedTrainerPersonId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "TrainingSessionTrainer" ("sessionId", "personId")
SELECT "id", "trainerPersonId"
FROM "TrainingSession"
WHERE "trainerPersonId" IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE "Training"
SET "plannedExternalTrainerNames" = ARRAY["externalTrainerName"]
WHERE "externalTrainerName" IS NOT NULL AND BTRIM("externalTrainerName") <> '';

UPDATE "TrainingSession"
SET "externalTrainerNames" = ARRAY["externalTrainerName"]
WHERE "externalTrainerName" IS NOT NULL AND BTRIM("externalTrainerName") <> '';

CREATE INDEX "TrainingPlannedTrainer_personId_idx" ON "TrainingPlannedTrainer"("personId");
CREATE INDEX "TrainingTargetDepartment_departmentId_idx" ON "TrainingTargetDepartment"("departmentId");
CREATE INDEX "TrainingSessionTrainer_personId_idx" ON "TrainingSessionTrainer"("personId");

ALTER TABLE "TrainingPlannedTrainer" ADD CONSTRAINT "TrainingPlannedTrainer_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingPlannedTrainer" ADD CONSTRAINT "TrainingPlannedTrainer_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingTargetDepartment" ADD CONSTRAINT "TrainingTargetDepartment_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingTargetDepartment" ADD CONSTRAINT "TrainingTargetDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingSessionTrainer" ADD CONSTRAINT "TrainingSessionTrainer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingSessionTrainer" ADD CONSTRAINT "TrainingSessionTrainer_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Training" DROP CONSTRAINT IF EXISTS "Training_plannedTrainerPersonId_fkey";
ALTER TABLE "TrainingSession" DROP CONSTRAINT IF EXISTS "TrainingSession_trainerPersonId_fkey";

ALTER TABLE "Training" DROP COLUMN "plannedTrainerPersonId";
ALTER TABLE "Training" DROP COLUMN "externalTrainerName";
ALTER TABLE "TrainingSession" DROP COLUMN "trainerPersonId";
ALTER TABLE "TrainingSession" DROP COLUMN "externalTrainerName";
