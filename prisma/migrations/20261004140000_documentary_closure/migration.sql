ALTER TABLE "DocumentControl"
  ADD COLUMN "dossierPrinted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "signedAnnexIIIReason" TEXT,
  ADD COLUMN "trainingMaterialReason" TEXT,
  ADD COLUMN "evaluationEvidenceReason" TEXT;

ALTER TABLE "Training"
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "closedByUserId" TEXT;

CREATE INDEX "Training_closedByUserId_idx" ON "Training"("closedByUserId");

ALTER TABLE "Training"
  ADD CONSTRAINT "Training_closedByUserId_fkey"
  FOREIGN KEY ("closedByUserId") REFERENCES "UserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
