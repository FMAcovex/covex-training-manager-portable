-- Registro maestro de formadores cualificados por materia y documentos de evidencia.
CREATE TABLE "TrainerQualification" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "authorizedSubject" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "qualifiedFrom" DATE NOT NULL,
    "qualifiedTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrainerQualification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainerDocument" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainerDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainerQualification_personId_authorizedSubject_qualifiedFrom_key"
ON "TrainerQualification"("personId", "authorizedSubject", "qualifiedFrom");

CREATE INDEX "TrainerQualification_personId_qualifiedTo_idx"
ON "TrainerQualification"("personId", "qualifiedTo");

CREATE INDEX "TrainerDocument_personId_createdAt_idx"
ON "TrainerDocument"("personId", "createdAt");

ALTER TABLE "TrainerQualification"
ADD CONSTRAINT "TrainerQualification_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TrainerDocument"
ADD CONSTRAINT "TrainerDocument_personId_fkey"
FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
