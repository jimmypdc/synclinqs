-- Phase 1 Production Features Migration
-- Adds multi-tenancy enhancements, teams, idempotency, and improved audit logging

-- ============================================
-- ORGANIZATIONS TABLE ENHANCEMENTS
-- ============================================

-- Add new columns (nullable first to handle existing data)
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(100);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "billing_plan" VARCHAR(50) DEFAULT 'trial';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscription_status" VARCHAR(50) DEFAULT 'active';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "max_employees" INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "max_api_calls_per_month" INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "settings" JSONB DEFAULT '{}';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';

-- Generate slugs for existing organizations
UPDATE "organizations"
SET "slug" = LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '-', 'g'))
WHERE "slug" IS NULL;

-- Ensure unique slugs by appending id suffix if needed
UPDATE "organizations" o1
SET "slug" = o1."slug" || '-' || SUBSTRING(o1."id"::text, 1, 8)
WHERE EXISTS (
  SELECT 1 FROM "organizations" o2
  WHERE o2."slug" = o1."slug" AND o2."id" != o1."id"
);

-- Add unique constraint and index on slug
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX IF NOT EXISTS "idx_organizations_subscription_status" ON "organizations"("subscription_status");

-- ============================================
-- USERS TABLE ENHANCEMENTS
-- ============================================

-- Add MFA and email verification columns
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" BOOLEAN DEFAULT false;

-- ============================================
-- AUDIT LOGS ENHANCEMENT
-- ============================================

-- Add organization_id to audit_logs for tenant context
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "organization_id" UUID;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'audit_logs_organization_id_fkey'
  ) THEN
    ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for organization audit queries
CREATE INDEX IF NOT EXISTS "idx_audit_logs_organization_created" ON "audit_logs"("organization_id", "created_at");

-- ============================================
-- TEAMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS "teams" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "parent_team_id" UUID REFERENCES "teams"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_teams_organization" ON "teams"("organization_id");
CREATE INDEX IF NOT EXISTS "idx_teams_parent" ON "teams"("parent_team_id");

-- ============================================
-- TEAM MEMBERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS "team_members" (
  "team_id" UUID NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" VARCHAR(50) NOT NULL DEFAULT 'member',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("team_id", "user_id")
);

-- ============================================
-- IDEMPOTENCY RECORDS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS "idempotency_records" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "idempotency_key" VARCHAR(255) NOT NULL,
  "request_path" VARCHAR(500) NOT NULL,
  "request_method" VARCHAR(10) NOT NULL,
  "status_code" INTEGER NOT NULL,
  "response_data" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  UNIQUE("organization_id", "idempotency_key")
);

CREATE INDEX IF NOT EXISTS "idx_idempotency_expires" ON "idempotency_records"("expires_at");

-- ============================================
-- ROW-LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on tenant tables
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deferral_elections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "file_uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_records" ENABLE ROW LEVEL SECURITY;

-- Create helper function to get current organization from session
CREATE OR REPLACE FUNCTION current_organization_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- Drop existing policies if they exist (for idempotent migrations)
DROP POLICY IF EXISTS tenant_isolation_employees ON "employees";
DROP POLICY IF EXISTS tenant_isolation_plans ON "plans";
DROP POLICY IF EXISTS tenant_isolation_integrations ON "integrations";
DROP POLICY IF EXISTS tenant_isolation_contributions ON "contributions";
DROP POLICY IF EXISTS tenant_isolation_loans ON "loans";
DROP POLICY IF EXISTS tenant_isolation_deferral_elections ON "deferral_elections";
DROP POLICY IF EXISTS tenant_isolation_file_uploads ON "file_uploads";
DROP POLICY IF EXISTS tenant_isolation_teams ON "teams";
DROP POLICY IF EXISTS tenant_isolation_idempotency ON "idempotency_records";

-- Employees policy - direct organization_id
CREATE POLICY tenant_isolation_employees ON "employees"
  FOR ALL
  USING (organization_id = current_organization_id() OR current_organization_id() IS NULL);

-- Plans policy - direct organization_id
CREATE POLICY tenant_isolation_plans ON "plans"
  FOR ALL
  USING (organization_id = current_organization_id() OR current_organization_id() IS NULL);

-- Integrations policy - direct organization_id
CREATE POLICY tenant_isolation_integrations ON "integrations"
  FOR ALL
  USING (organization_id = current_organization_id() OR current_organization_id() IS NULL);

-- Contributions policy - via employee relationship
CREATE POLICY tenant_isolation_contributions ON "contributions"
  FOR ALL
  USING (
    current_organization_id() IS NULL OR
    employee_id IN (
      SELECT id FROM employees WHERE organization_id = current_organization_id()
    )
  );

-- Loans policy - via employee relationship
CREATE POLICY tenant_isolation_loans ON "loans"
  FOR ALL
  USING (
    current_organization_id() IS NULL OR
    employee_id IN (
      SELECT id FROM employees WHERE organization_id = current_organization_id()
    )
  );

-- Deferral elections policy - via employee relationship
CREATE POLICY tenant_isolation_deferral_elections ON "deferral_elections"
  FOR ALL
  USING (
    current_organization_id() IS NULL OR
    employee_id IN (
      SELECT id FROM employees WHERE organization_id = current_organization_id()
    )
  );

-- File uploads policy - via integration relationship
CREATE POLICY tenant_isolation_file_uploads ON "file_uploads"
  FOR ALL
  USING (
    current_organization_id() IS NULL OR
    integration_id IN (
      SELECT id FROM integrations WHERE organization_id = current_organization_id()
    )
  );

-- Teams policy - direct organization_id
CREATE POLICY tenant_isolation_teams ON "teams"
  FOR ALL
  USING (organization_id = current_organization_id() OR current_organization_id() IS NULL);

-- Idempotency records policy - direct organization_id
CREATE POLICY tenant_isolation_idempotency ON "idempotency_records"
  FOR ALL
  USING (organization_id = current_organization_id() OR current_organization_id() IS NULL);

-- ============================================
-- CLEANUP JOB FOR EXPIRED IDEMPOTENCY RECORDS
-- ============================================

-- Create a function to clean up expired records
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_records() RETURNS void AS $$
BEGIN
  DELETE FROM idempotency_records WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
