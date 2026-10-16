CREATE TABLE "TrainingImportRun" (
  "id" TEXT NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "summaryJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrainingImportRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingImportRun_sourceFingerprint_key" ON "TrainingImportRun"("sourceFingerprint");
CREATE INDEX "TrainingImportRun_year_createdAt_idx" ON "TrainingImportRun"("year", "createdAt");
CREATE INDEX "TrainingImportRun_actorUserId_idx" ON "TrainingImportRun"("actorUserId");

ALTER TABLE "TrainingImportRun"
  ADD CONSTRAINT "TrainingImportRun_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
