ALTER TABLE "TrainerQualification"
  ADD COLUMN "annulledAt" TIMESTAMP(3),
  ADD COLUMN "annulledByUserId" TEXT,
  ADD COLUMN "annulmentReason" TEXT;

CREATE INDEX "TrainerQualification_annulledAt_idx"
  ON "TrainerQualification"("annulledAt");

CREATE TYPE "DocumentControlAttachmentCategory" AS ENUM (
  'SIGNED_ANNEX_III',
  'TRAINING_MATERIAL',
  'EVALUATION_EVIDENCE'
);

CREATE TABLE "DocumentControlAttachment" (
  "id" TEXT NOT NULL,
  "documentControlId" TEXT NOT NULL,
  "category" "DocumentControlAttachmentCategory" NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "content" BYTEA NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DocumentControlAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentControlAttachment_documentControlId_category_createdAt_idx"
  ON "DocumentControlAttachment"("documentControlId", "category", "createdAt");

ALTER TABLE "DocumentControlAttachment"
  ADD CONSTRAINT "DocumentControlAttachment_documentControlId_fkey"
  FOREIGN KEY ("documentControlId") REFERENCES "DocumentControl"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
