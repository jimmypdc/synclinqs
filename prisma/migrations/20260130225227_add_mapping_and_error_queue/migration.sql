/*
  Warnings:

  - Made the column `slug` on table `organizations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `billing_plan` on table `organizations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `subscription_status` on table `organizations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `settings` on table `organizations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metadata` on table `organizations` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mfa_enabled` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email_verified` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "FieldDataType" AS ENUM ('STRING', 'NUMBER', 'DATE', 'BOOLEAN', 'ARRAY', 'OBJECT');

-- CreateEnum
CREATE TYPE "MappingType" AS ENUM ('CONTRIBUTION', 'EMPLOYEE', 'ELECTION', 'LOAN');

-- CreateEnum
CREATE TYPE "TransformationFunctionType" AS ENUM ('STRING', 'NUMERIC', 'DATE', 'LOOKUP', 'CONDITIONAL', 'COMPOSITE');

-- CreateEnum
CREATE TYPE "ValidationRuleType" AS ENUM ('IRS_LIMIT', 'FORMAT', 'BUSINESS_LOGIC', 'REQUIRED_FIELD', 'RANGE', 'PATTERN');

-- CreateEnum
CREATE TYPE "ValidationSeverity" AS ENUM ('ERROR', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "ErrorType" AS ENUM ('MAPPING_ERROR', 'VALIDATION_ERROR', 'API_ERROR', 'FILE_FORMAT_ERROR', 'NETWORK_ERROR', 'TIMEOUT_ERROR', 'AUTHENTICATION_ERROR', 'RATE_LIMIT_ERROR', 'DATA_INTEGRITY_ERROR', 'UNKNOWN_ERROR');

-- CreateEnum
CREATE TYPE "ErrorSeverity" AS ENUM ('CRITICAL', 'ERROR', 'WARNING');

-- CreateEnum
CREATE TYPE "ErrorQueueStatus" AS ENUM ('PENDING', 'RETRYING', 'RESOLVED', 'FAILED_PERMANENTLY', 'MANUAL_REVIEW', 'IGNORED');

-- CreateEnum
CREATE TYPE "RetryResult" AS ENUM ('SUCCESS', 'FAILED', 'TRANSIENT_ERROR', 'PERMANENT_ERROR');

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "idempotency_records" DROP CONSTRAINT "idempotency_records_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "team_members" DROP CONSTRAINT "team_members_team_id_fkey";

-- DropForeignKey
ALTER TABLE "team_members" DROP CONSTRAINT "team_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "teams" DROP CONSTRAINT "teams_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "teams" DROP CONSTRAINT "teams_parent_team_id_fkey";

-- AlterTable
ALTER TABLE "idempotency_records" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "slug" SET NOT NULL,
ALTER COLUMN "billing_plan" SET NOT NULL,
ALTER COLUMN "subscription_status" SET NOT NULL,
ALTER COLUMN "settings" SET NOT NULL,
ALTER COLUMN "metadata" SET NOT NULL;

-- AlterTable
ALTER TABLE "teams" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "mfa_enabled" SET NOT NULL,
ALTER COLUMN "email_verified" SET NOT NULL;

-- CreateTable
CREATE TABLE "field_definitions" (
    "id" UUID NOT NULL,
    "system_name" VARCHAR(100) NOT NULL,
    "field_name" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "data_type" "FieldDataType" NOT NULL,
    "format_pattern" VARCHAR(255),
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_pii" BOOLEAN NOT NULL DEFAULT false,
    "validation_rules" JSONB,
    "description" TEXT,
    "example_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapping_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "source_system" VARCHAR(100) NOT NULL,
    "destination_system" VARCHAR(100) NOT NULL,
    "mapping_type" "MappingType" NOT NULL,
    "template_rules" JSONB NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mapping_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapping_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "source_system" VARCHAR(100) NOT NULL,
    "destination_system" VARCHAR(100) NOT NULL,
    "mapping_type" "MappingType" NOT NULL,
    "mapping_rules" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "template_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "mapping_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transformation_functions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "function_type" "TransformationFunctionType" NOT NULL,
    "input_type" "FieldDataType" NOT NULL,
    "output_type" "FieldDataType" NOT NULL,
    "function_code" TEXT NOT NULL,
    "test_cases" JSONB,
    "is_system_function" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transformation_functions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapping_execution_logs" (
    "id" UUID NOT NULL,
    "mapping_config_id" UUID NOT NULL,
    "file_upload_id" UUID,
    "execution_start" TIMESTAMP(3) NOT NULL,
    "execution_end" TIMESTAMP(3),
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_successful" INTEGER NOT NULL DEFAULT 0,
    "records_failed" INTEGER NOT NULL DEFAULT 0,
    "error_summary" JSONB,
    "sample_errors" JSONB,
    "performance_metrics" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mapping_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "rule_type" "ValidationRuleType" NOT NULL,
    "applies_to" VARCHAR(100) NOT NULL,
    "rule_logic" JSONB NOT NULL,
    "error_message" TEXT NOT NULL,
    "severity" "ValidationSeverity" NOT NULL DEFAULT 'ERROR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_queue" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "error_type" "ErrorType" NOT NULL,
    "severity" "ErrorSeverity" NOT NULL DEFAULT 'ERROR',
    "source_system" VARCHAR(100),
    "destination_system" VARCHAR(100),
    "record_id" UUID,
    "record_type" VARCHAR(100),
    "error_data" JSONB NOT NULL,
    "error_message" TEXT NOT NULL,
    "error_stack" TEXT,
    "error_code" VARCHAR(100),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "next_retry_at" TIMESTAMP(3),
    "status" "ErrorQueueStatus" NOT NULL DEFAULT 'PENDING',
    "resolution_notes" TEXT,
    "resolved_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "error_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retry_logs" (
    "id" UUID NOT NULL,
    "error_queue_id" UUID NOT NULL,
    "retry_attempt" INTEGER NOT NULL,
    "retry_at" TIMESTAMP(3) NOT NULL,
    "retry_result" "RetryResult" NOT NULL,
    "error_message" TEXT,
    "response_data" JSONB,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retry_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_definitions_system_name_idx" ON "field_definitions"("system_name");

-- CreateIndex
CREATE INDEX "field_definitions_is_pii_idx" ON "field_definitions"("is_pii");

-- CreateIndex
CREATE UNIQUE INDEX "field_definitions_system_name_field_name_key" ON "field_definitions"("system_name", "field_name");

-- CreateIndex
CREATE INDEX "mapping_templates_source_system_destination_system_idx" ON "mapping_templates"("source_system", "destination_system");

-- CreateIndex
CREATE UNIQUE INDEX "mapping_templates_source_system_destination_system_mapping__key" ON "mapping_templates"("source_system", "destination_system", "mapping_type");

-- CreateIndex
CREATE INDEX "mapping_configurations_organization_id_is_active_idx" ON "mapping_configurations"("organization_id", "is_active");

-- CreateIndex
CREATE INDEX "mapping_configurations_source_system_destination_system_idx" ON "mapping_configurations"("source_system", "destination_system");

-- CreateIndex
CREATE UNIQUE INDEX "transformation_functions_name_key" ON "transformation_functions"("name");

-- CreateIndex
CREATE INDEX "transformation_functions_function_type_idx" ON "transformation_functions"("function_type");

-- CreateIndex
CREATE INDEX "mapping_execution_logs_mapping_config_id_idx" ON "mapping_execution_logs"("mapping_config_id");

-- CreateIndex
CREATE INDEX "mapping_execution_logs_execution_start_idx" ON "mapping_execution_logs"("execution_start");

-- CreateIndex
CREATE INDEX "validation_rules_rule_type_idx" ON "validation_rules"("rule_type");

-- CreateIndex
CREATE INDEX "validation_rules_is_active_idx" ON "validation_rules"("is_active");

-- CreateIndex
CREATE INDEX "validation_rules_organization_id_idx" ON "validation_rules"("organization_id");

-- CreateIndex
CREATE INDEX "error_queue_organization_id_status_idx" ON "error_queue"("organization_id", "status");

-- CreateIndex
CREATE INDEX "error_queue_next_retry_at_idx" ON "error_queue"("next_retry_at");

-- CreateIndex
CREATE INDEX "error_queue_error_type_idx" ON "error_queue"("error_type");

-- CreateIndex
CREATE INDEX "error_queue_status_next_retry_at_idx" ON "error_queue"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "retry_logs_error_queue_id_idx" ON "retry_logs"("error_queue_id");

-- CreateIndex
CREATE INDEX "retry_logs_retry_at_idx" ON "retry_logs"("retry_at");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_parent_team_id_fkey" FOREIGN KEY ("parent_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapping_configurations" ADD CONSTRAINT "mapping_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapping_configurations" ADD CONSTRAINT "mapping_configurations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "mapping_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapping_execution_logs" ADD CONSTRAINT "mapping_execution_logs_mapping_config_id_fkey" FOREIGN KEY ("mapping_config_id") REFERENCES "mapping_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mapping_execution_logs" ADD CONSTRAINT "mapping_execution_logs_file_upload_id_fkey" FOREIGN KEY ("file_upload_id") REFERENCES "file_uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_rules" ADD CONSTRAINT "validation_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "error_queue" ADD CONSTRAINT "error_queue_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retry_logs" ADD CONSTRAINT "retry_logs_error_queue_id_fkey" FOREIGN KEY ("error_queue_id") REFERENCES "error_queue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_audit_logs_organization_created" RENAME TO "audit_logs_organization_id_created_at_idx";

-- RenameIndex
ALTER INDEX "idx_idempotency_expires" RENAME TO "idempotency_records_expires_at_idx";

-- RenameIndex
ALTER INDEX "idx_organizations_subscription_status" RENAME TO "organizations_subscription_status_idx";

-- RenameIndex
ALTER INDEX "idx_teams_organization" RENAME TO "teams_organization_id_idx";

-- RenameIndex
ALTER INDEX "idx_teams_parent" RENAME TO "teams_parent_team_id_idx";
