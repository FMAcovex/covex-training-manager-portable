ALTER TABLE "TrainerQualification"
ADD COLUMN "authorizedSubjectNormalized" TEXT;

UPDATE "TrainerQualification"
SET "authorizedSubjectNormalized" = lower(btrim("authorizedSubject"));

ALTER TABLE "TrainerQualification"
ALTER COLUMN "authorizedSubjectNormalized" SET NOT NULL;

DROP INDEX IF EXISTS "TrainerQualification_personId_authorizedSubject_qualifiedFrom_key";

CREATE UNIQUE INDEX "TrainerQualification_personId_authorizedSubjectNormalized_qualifiedFrom_key"
ON "TrainerQualification"("personId", "authorizedSubjectNormalized", "qualifiedFrom");
