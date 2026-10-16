-- Baseline PostgreSQL schema for COVEX Training Manager

CREATE TYPE "PersonType" AS ENUM ('INTERNAL', 'EXTERNAL');
CREATE TYPE "UserRole" AS ENUM ('USER', 'RESPONSIBLE', 'ADMIN');
CREATE TYPE "PlanningType" AS ENUM ('PLANNED', 'UNPLANNED');
CREATE TYPE "TrainingOriginType" AS ENUM ('INTERNAL', 'EXTERNAL');
CREATE TYPE "SessionExecutionStatus" AS ENUM ('PENDING', 'EXECUTED', 'NOT_EXECUTED');
CREATE TYPE "AttendanceStatus" AS ENUM ('EXPECTED', 'ATTENDED', 'NOT_ATTENDED');
CREATE TYPE "AttendanceResult" AS ENUM ('PENDING', 'PASS', 'FAIL', 'NOT_APPLICABLE');
CREATE TYPE "AnnexType" AS ENUM ('ANNEX_III', 'ANNEX_IV', 'ANNEX_V');

CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Person" (
  "id" TEXT NOT NULL,
  "employeeCode" TEXT,
  "fullName" TEXT NOT NULL,
  "personType" "PersonType" NOT NULL,
  "company" TEXT,
  "departmentId" TEXT,
  "jobTitle" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProfile" (
  "id" TEXT NOT NULL,
  "entraObjectId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingType" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "TrainingType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Modality" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Modality_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvaluationMethod" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "EvaluationMethod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Training" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "planningType" "PlanningType" NOT NULL,
  "trainingTypeId" TEXT,
  "reason" TEXT,
  "isGmp" BOOLEAN NOT NULL DEFAULT false,
  "originType" "TrainingOriginType" NOT NULL,
  "modalityId" TEXT,
  "plannedDurationMinutes" INTEGER,
  "materialReference" TEXT,
  "content" TEXT,
  "targetGroup" TEXT,
  "plannedTrainerPersonId" TEXT,
  "externalTrainerName" TEXT,
  "evaluationMethodId" TEXT,
  "aptitudeCriterion" TEXT,
  "frequencyMonths" INTEGER,
  "notes" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingCodeSequence" (
  "year" INTEGER NOT NULL,
  "lastValue" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingCodeSequence_pkey" PRIMARY KEY ("year")
);

CREATE TABLE "TrainingSession" (
  "id" TEXT NOT NULL,
  "trainingId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "plannedDate" DATE NOT NULL,
  "executionDate" DATE,
  "trainerPersonId" TEXT,
  "externalTrainerName" TEXT,
  "durationMinutes" INTEGER NOT NULL,
  "executionStatus" "SessionExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "nonExecutionReason" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "executedAt" TIMESTAMP(3),
  "executedByUserId" TEXT,
  CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentControl" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "signedAnnexIII" BOOLEAN NOT NULL DEFAULT false,
  "trainingMaterialArchived" BOOLEAN NOT NULL DEFAULT false,
  "evaluationEvidenceArchived" BOOLEAN NOT NULL DEFAULT false,
  "updatedByUserId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentControl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Attendance" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "attendanceStatus" "AttendanceStatus" NOT NULL DEFAULT 'EXPECTED',
  "result" "AttendanceResult" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SessionCodeSequence" (
  "trainingId" TEXT NOT NULL,
  "lastValue" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SessionCodeSequence_pkey" PRIMARY KEY ("trainingId")
);

CREATE TABLE "TemplateVersion" (
  "id" TEXT NOT NULL,
  "annexType" "AnnexType" NOT NULL,
  "procedureCode" TEXT NOT NULL,
  "templateVersion" TEXT NOT NULL,
  "storageProvider" TEXT NOT NULL,
  "storageReference" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeneratedDocument" (
  "id" TEXT NOT NULL,
  "annexType" "AnnexType" NOT NULL,
  "templateVersionId" TEXT NOT NULL,
  "sessionId" TEXT,
  "personId" TEXT,
  "year" INTEGER,
  "generatedByUserId" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "contextJson" JSONB,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");
CREATE UNIQUE INDEX "Person_employeeCode_key" ON "Person"("employeeCode");
CREATE UNIQUE INDEX "UserProfile_entraObjectId_key" ON "UserProfile"("entraObjectId");
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");
CREATE UNIQUE INDEX "TrainingType_code_key" ON "TrainingType"("code");
CREATE UNIQUE INDEX "Modality_code_key" ON "Modality"("code");
CREATE UNIQUE INDEX "EvaluationMethod_code_key" ON "EvaluationMethod"("code");
CREATE UNIQUE INDEX "Training_code_key" ON "Training"("code");
CREATE INDEX "Training_year_idx" ON "Training"("year");
CREATE INDEX "Training_name_idx" ON "Training"("name");
CREATE INDEX "Training_planningType_idx" ON "Training"("planningType");
CREATE INDEX "Training_trainingTypeId_idx" ON "Training"("trainingTypeId");
CREATE INDEX "Training_originType_idx" ON "Training"("originType");
CREATE UNIQUE INDEX "TrainingSession_code_key" ON "TrainingSession"("code");
CREATE INDEX "TrainingSession_trainingId_idx" ON "TrainingSession"("trainingId");
CREATE INDEX "TrainingSession_executionStatus_idx" ON "TrainingSession"("executionStatus");
CREATE INDEX "TrainingSession_plannedDate_idx" ON "TrainingSession"("plannedDate");
CREATE UNIQUE INDEX "DocumentControl_sessionId_key" ON "DocumentControl"("sessionId");
CREATE INDEX "DocumentControl_updatedByUserId_idx" ON "DocumentControl"("updatedByUserId");
CREATE UNIQUE INDEX "Attendance_sessionId_personId_key" ON "Attendance"("sessionId", "personId");
CREATE INDEX "Attendance_personId_idx" ON "Attendance"("personId");
CREATE UNIQUE INDEX "TemplateVersion_annexType_procedureCode_templateVersion_key" ON "TemplateVersion"("annexType", "procedureCode", "templateVersion");
CREATE INDEX "TemplateVersion_annexType_active_effectiveFrom_effectiveTo_idx" ON "TemplateVersion"("annexType", "active", "effectiveFrom", "effectiveTo");
CREATE INDEX "GeneratedDocument_sessionId_generatedAt_idx" ON "GeneratedDocument"("sessionId", "generatedAt");
CREATE INDEX "GeneratedDocument_personId_year_generatedAt_idx" ON "GeneratedDocument"("personId", "year", "generatedAt");
CREATE INDEX "GeneratedDocument_year_generatedAt_idx" ON "GeneratedDocument"("year", "generatedAt");
CREATE INDEX "GeneratedDocument_templateVersionId_idx" ON "GeneratedDocument"("templateVersionId");
CREATE INDEX "GeneratedDocument_generatedByUserId_idx" ON "GeneratedDocument"("generatedByUserId");
CREATE INDEX "AuditEvent_timestamp_idx" ON "AuditEvent"("timestamp");
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

ALTER TABLE "Person" ADD CONSTRAINT "Person_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Training" ADD CONSTRAINT "Training_trainingTypeId_fkey" FOREIGN KEY ("trainingTypeId") REFERENCES "TrainingType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Training" ADD CONSTRAINT "Training_modalityId_fkey" FOREIGN KEY ("modalityId") REFERENCES "Modality"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Training" ADD CONSTRAINT "Training_plannedTrainerPersonId_fkey" FOREIGN KEY ("plannedTrainerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Training" ADD CONSTRAINT "Training_evaluationMethodId_fkey" FOREIGN KEY ("evaluationMethodId") REFERENCES "EvaluationMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainerPersonId_fkey" FOREIGN KEY ("trainerPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentControl" ADD CONSTRAINT "DocumentControl_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentControl" ADD CONSTRAINT "DocumentControl_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
