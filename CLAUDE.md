# SyncLinqs - 401(k) Recordkeeper-Payroll Integration Platform

## Project Overview
SyncLinqs provides seamless, secure integration between 401(k) recordkeepers and payroll systems, handling sensitive financial data with enterprise-grade security and compliance requirements.

## Core Purpose
- Enable automated data exchange between payroll providers and 401(k) recordkeepers
- Process contribution elections, deferral changes, and loan repayments
- Ensure ERISA compliance and maintain comprehensive audit trails
- Support multiple recordkeepers and payroll systems through standardized APIs

## Technology Stack

### Database
- **PostgreSQL 15+** (AWS RDS recommended for production)
- Row-level security (RLS) policies for multi-tenant data isolation
- Field-level encryption for PII and sensitive financial data
- Automated backups with point-in-time recovery

### Backend API
- **Node.js 18+ with TypeScript** (or Python 3.11+ with FastAPI as alternative)
- **Express.js** for REST API endpoints
- **GraphQL** (Apollo Server) for flexible client queries
- **Prisma ORM** for type-safe database queries and migrations

### Authentication & Security
- **OAuth 2.0** for user authentication
- **SAML 2.0** support for enterprise SSO
- **JWT tokens** with short expiration and refresh token rotation
- **HashiCorp Vault** for secrets management
- Rate limiting and API key management per client

### Data Processing
- **Bull Queue** (Redis-backed) for job processing
- **Apache Airflow** (or temporal.io) for complex ETL workflows
- **Node-cron** for scheduled batch processing
- File processing: SFTP uploads, CSV/Excel parsing, validation

### Monitoring & Compliance
- **Winston** for structured logging
- **Prometheus + Grafana** for metrics
- **Sentry** for error tracking
- Audit log table tracking all data access and modifications

### Development Tools
- **Docker** for local development environment
- **Jest** for unit and integration testing
- **Supertest** for API testing
- **ESLint + Prettier** for code quality
- **Husky** for pre-commit hooks

## Architecture Principles

### Multi-Tenancy Design
1. **Organization Isolation**: Every table with customer data has `organization_id` foreign key
2. **Row-Level Security**: PostgreSQL RLS policies enforce data isolation
3. **Tenant Context**: All API requests include organization context from JWT token
4. **Shared Infrastructure**: Single database, compute resources shared across tenants
5. **Per-Tenant Configuration**: Settings, integrations, mappings scoped to organization
6. **Cross-Tenant Queries Prohibited**: Application layer enforces tenant boundaries

### Security First
1. **Encryption**: All PII encrypted at rest using AES-256
2. **Network Security**: VPC isolation, private subnets for database
3. **Access Control**: Role-based access control (RBAC) with least privilege
4. **Audit Logging**: Every data access logged with timestamp, user, and action
5. **Input Validation**: Strict validation on all API inputs, SQL injection prevention

### Data Integrity
1. **Idempotency**: All API endpoints idempotent using idempotency keys
2. **Transactions**: Use database transactions for multi-step operations
3. **Validation**: Validate contribution amounts against IRS limits
4. **Reconciliation**: Daily reconciliation reports between source and destination
5. **Deduplication**: Prevent duplicate contributions and records

### Scalability
1. **Stateless APIs**: All state in database or cache, enable horizontal scaling
2. **Connection Pooling**: Optimize database connections (PgBouncer)
3. **Caching**: Redis for frequently accessed reference data
4. **Async Processing**: Heavy operations queued, never block API responses
5. **Rate Limiting**: Per-organization rate limits to prevent abuse

### Reliability & Resilience
1. **Retry Logic**: Automatic retry with exponential backoff for transient failures
2. **Circuit Breakers**: Prevent cascade failures from external APIs
3. **Dead Letter Queues**: Isolate permanently failed records
4. **Health Checks**: Continuous monitoring of all integrations
5. **Graceful Degradation**: Core features work even if ancillary services fail

### Compliance Requirements
1. **ERISA Compliance**: Maintain participant records per DOL requirements
2. **SOC 2 Type II**: Design with SOC 2 controls in mind
3. **Data Retention**: Implement 7-year retention policy with automated archival
4. **Right to Delete**: Support CCPA/GDPR deletion requests while maintaining compliance
5. **Audit Trail**: Complete, immutable audit logs for all financial transactions

## Database Schema Overview

### Core Tables
- `organizations` - Payroll providers and recordkeepers (multi-tenant)
- `users` - System users with role-based access control
- `teams` - Team structure within organizations
- `employees` - Plan participants with encrypted PII
- `plans` - 401(k) plan configurations
- `contributions` - Contribution records with amounts and dates
- `deferral_elections` - Employee deferral percentage choices
- `loans` - Active loan records and repayment schedules
- `integrations` - API credentials and connection configs (encrypted)
- `audit_logs` - Comprehensive audit trail
- `file_uploads` - Tracking for batch file processing

### Mapping & Transformation Tables
- `mapping_configurations` - Customer-specific field mappings between systems
- `mapping_templates` - Pre-built mapping templates (e.g., ADP→Fidelity)
- `transformation_functions` - Reusable data transformation logic
- `field_definitions` - Standard field catalog for all supported systems
- `mapping_execution_logs` - Track mapping performance and errors
- `validation_rules` - Business rules for mapped data validation

### Reconciliation & Error Handling Tables
- `reconciliation_reports` - Daily reconciliation results
- `reconciliation_items` - Individual matched/unmatched records
- `error_queue` - Failed records awaiting retry or manual intervention
- `retry_logs` - Track retry attempts and outcomes
- `sync_jobs` - Scheduled and on-demand sync jobs
- `job_executions` - Track job runs, status, and metrics

### Notifications & Workflow Tables
- `notifications` - In-app notification center
- `notification_preferences` - User notification settings
- `alert_rules` - Configurable alerting thresholds
- `approval_workflows` - Multi-level approval configurations
- `approval_requests` - Pending approval items
- `webhooks` - Customer webhook registrations
- `webhook_deliveries` - Webhook delivery logs and retries

### Key Design Patterns
- Use UUIDs for primary keys (prevents enumeration attacks)
- Soft deletes with `deleted_at` timestamp
- `created_at`, `updated_at`, `created_by`, `updated_by` on all tables
- Partitioning for large tables (contributions by year)

## API Design Standards

### RESTful Endpoints
```
POST   /api/v1/contributions       - Create contribution records
GET    /api/v1/contributions/:id   - Retrieve contribution
PATCH  /api/v1/contributions/:id   - Update contribution
DELETE /api/v1/contributions/:id   - Soft delete contribution

POST   /api/v1/employees           - Create employee record
GET    /api/v1/employees/:id       - Get employee details
PATCH  /api/v1/employees/:id       - Update employee info

POST   /api/v1/integrations/sync   - Trigger manual sync
GET    /api/v1/integrations/status - Check sync status
```

### Request/Response Format
- All requests/responses in JSON
- Use ISO 8601 for dates: `2024-01-29T10:30:00Z`
- Currency amounts as integers (cents): `10000` = $100.00
- Pagination: `?page=1&limit=50`
- Filtering: `?status=active&plan_id=uuid`

### Error Handling
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid contribution amount",
    "details": [
      {
        "field": "amount",
        "message": "Amount exceeds annual limit"
      }
    ],
    "request_id": "req_abc123"
  }
}
```

## Development Workflow

### Getting Started
1. Review this CLAUDE.md file
2. Set up local PostgreSQL database
3. Copy `.env.example` to `.env` and configure
4. Run `npm install` to install dependencies
5. Run `npm run migrate` to set up database schema
6. Run `npm run seed` to populate test data
7. Run `npm run dev` to start development server

### Testing Strategy
- **Unit Tests**: All business logic functions
- **Integration Tests**: API endpoints with test database
- **E2E Tests**: Critical user flows
- **Security Tests**: SQL injection, XSS, CSRF prevention
- **Load Tests**: Batch processing with realistic data volumes

### Code Organization
```
/src
  /api
    /controllers  - Request handlers
    /routes       - API route definitions
    /middleware   - Auth, validation, error handling, idempotency, tenant context
  /services       - Business logic layer
    MappingService.ts           - Core mapping engine
    TransformationService.ts    - Data transformation logic
    ValidationService.ts        - Business rule validation
    ReconciliationService.ts    - Daily reconciliation engine
    RetryService.ts             - Error retry and recovery
    NotificationService.ts      - Multi-channel notifications
    JobSchedulerService.ts      - Scheduled job management
    DeduplicationService.ts     - Duplicate detection and prevention
    FileGenerationService.ts    - Export file generation
  /repositories   - Database access layer
  /models         - Data models and types
  /utils          - Helper functions
  /config         - Configuration management
  /workers        - Background job processors
    retry-worker.ts             - Process retry queue
    reconciliation-worker.ts    - Daily reconciliation job
    notification-worker.ts      - Send notifications
    scheduled-jobs-worker.ts    - Execute cron jobs
  /transformations - Built-in transformation functions
/tests
  /unit
  /integration
  /e2e
  /load          - Performance and load tests
/prisma
  /migrations     - Database migrations
  schema.prisma   - Database schema definition
/scripts          - Utility scripts
  seed.ts         - Database seeding
  create-template.ts - Create mapping template
/templates        - Pre-built mapping templates
  /payroll        - Payroll system field definitions
  /recordkeepers  - Recordkeeper field definitions
  /mappings       - Complete mapping templates
```

### Environment Variables
```
# SyncLinqs Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/synclinqs
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-encryption-key
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
LOG_LEVEL=info
NODE_ENV=development
APP_NAME=SyncLinqs
API_VERSION=v1
```

## Coding Standards

### TypeScript
- Strict mode enabled
- No `any` types unless absolutely necessary
- Interfaces for all API contracts
- Zod for runtime validation

### Error Handling
- Never throw unhandled errors
- Always use try-catch in async functions
- Log errors with context (request ID, user ID)
- Return appropriate HTTP status codes

### Security Practices
- Never log sensitive data (SSN, passwords, tokens)
- Parameterized queries only (no string concatenation)
- Validate and sanitize all inputs
- Use environment variables for secrets
- Implement rate limiting on all endpoints

### Database Access
- Use ORM (Prisma) for type safety
- Always use transactions for multi-step operations
- Index foreign keys and frequently queried columns
- Avoid N+1 queries (use joins or batch loading)

## Common Tasks

### Adding a New API Endpoint
1. Define route in `/src/api/routes`
2. Create controller in `/src/api/controllers`
3. Implement service logic in `/src/services`
4. Add repository methods in `/src/repositories`
5. Write validation schema with Zod
6. Add unit and integration tests
7. Update API documentation

### Adding a New Database Table
1. Update Prisma schema in `prisma/schema.prisma`
2. Run `npm run migrate:dev` to create migration
3. Update TypeScript types if needed
4. Add repository methods
5. Update seed data if applicable

### Creating a New Mapping Template
1. Research field definitions for both systems
2. Document field mappings in spreadsheet
3. Test with real sample data
4. Create transformation functions as needed
5. Add to `mapping_templates` table
6. Mark as verified after validation
7. Document in integration guide

### Implementing a Custom Transformation
1. Add function to `transformation_functions` table
2. Write JavaScript/SQL implementation
3. Add test cases with input/output examples
4. Test with edge cases (null, empty, invalid)
5. Document parameters and return values
6. Make available in mapping UI

### Processing Batch Files
1. Store file metadata in `file_uploads` table
2. Queue processing job with Bull
3. Load appropriate mapping configuration
4. Parse and validate file contents
5. Apply field mappings and transformations
6. Process in transactions (rollback on error)
7. Log mapping execution metrics
8. Generate reconciliation report
9. Update file status and log results

## Integration Patterns

### Connecting to Payroll Systems
- SFTP file exchange (most common)
- REST API webhooks
- Scheduled polling
- Support multiple formats: CSV, Excel, fixed-width

### Connecting to Recordkeepers
- REST APIs with OAuth 2.0
- SOAP services (legacy systems)
- Flat file generation (SFTP upload)
- Real-time vs. batch processing

### Data Flow
1. Receive payroll data (contributions, elections)
2. Validate against business rules and IRS limits
3. **Apply field mappings and transformations** (critical step)
4. Transform to recordkeeper format
5. Transmit to recordkeeper
6. Receive confirmation
7. Update internal records
8. Generate reports and notifications

## Data Mapping Architecture

### Overview
SyncLinqs must support seamless data exchange between diverse payroll systems and recordkeepers, each using different field names, formats, and structures. A robust mapping system is essential for scalability and eliminates custom code per integration.

### Why Mapping is Critical
- **Different Field Names**: ADP uses `employee_ssn`, Fidelity expects `participant_tin`
- **Format Variations**: Dates (`MM/DD/YYYY` vs `YYYY-MM-DD`), currency (dollars vs cents), percentages (5.5 vs 0.055)
- **Data Structure Differences**: Flat files vs nested JSON, single vs multiple contribution types
- **Business Logic**: Conditional mappings based on plan type, employee status, or contribution category

### Mapping Types

**1. Direct Field Mapping**
```
source.employee_ssn → destination.participant_tin
```

**2. Transformation Mapping**
```
source.gross_pay → formatCurrency() → destination.eligible_compensation
source.deferral_pct → convertToDecimal() → destination.election_percentage
```

**3. Conditional Mapping**
```
IF source.contribution_type = "PRE_TAX" THEN destination.deferral_type = "1"
IF source.contribution_type = "ROTH" THEN destination.deferral_type = "2"
```

**4. Calculated Mapping**
```
source.gross_pay * source.deferral_pct = destination.contribution_amount
```

**5. Lookup Mapping**
```
source.plan_code → [lookup_table] → destination.recordkeeper_plan_id
```

**6. Multi-Field Mapping**
```
source.first_name + " " + source.last_name → destination.participant_name
```

### Database Schema for Mapping

#### mapping_configurations
```sql
CREATE TABLE mapping_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    source_system VARCHAR(100) NOT NULL, -- 'adp', 'paychex', 'gusto'
    destination_system VARCHAR(100) NOT NULL, -- 'fidelity', 'vanguard', 'empower'
    mapping_type VARCHAR(50) NOT NULL, -- 'contribution', 'employee', 'election'
    mapping_rules JSONB NOT NULL, -- Flexible storage for complex rules
    is_active BOOLEAN DEFAULT true,
    is_template BOOLEAN DEFAULT false, -- Pre-built templates vs custom
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, source_system, destination_system, mapping_type)
);

CREATE INDEX idx_mapping_org_systems ON mapping_configurations(organization_id, source_system, destination_system);
CREATE INDEX idx_mapping_active ON mapping_configurations(is_active);
```

#### mapping_templates
```sql
CREATE TABLE mapping_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_system VARCHAR(100) NOT NULL,
    destination_system VARCHAR(100) NOT NULL,
    mapping_type VARCHAR(50) NOT NULL,
    template_rules JSONB NOT NULL,
    usage_count INTEGER DEFAULT 0, -- Track popularity
    is_verified BOOLEAN DEFAULT false, -- SyncLinqs team verified
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_system, destination_system, mapping_type)
);

CREATE INDEX idx_template_systems ON mapping_templates(source_system, destination_system);
```

#### field_definitions
```sql
CREATE TABLE field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_name VARCHAR(100) NOT NULL, -- 'adp', 'fidelity', etc.
    field_name VARCHAR(255) NOT NULL, -- 'employee_ssn', 'participant_tin'
    display_name VARCHAR(255) NOT NULL, -- Human-readable name
    data_type VARCHAR(50) NOT NULL, -- 'string', 'number', 'date', 'boolean'
    format_pattern VARCHAR(255), -- 'XXX-XX-XXXX', 'YYYY-MM-DD'
    is_required BOOLEAN DEFAULT false,
    is_pii BOOLEAN DEFAULT false, -- Needs encryption
    validation_rules JSONB, -- Min/max, regex patterns
    description TEXT,
    example_value TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(system_name, field_name)
);

CREATE INDEX idx_field_system ON field_definitions(system_name);
CREATE INDEX idx_field_pii ON field_definitions(is_pii);
```

#### transformation_functions
```sql
CREATE TABLE transformation_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    function_type VARCHAR(50) NOT NULL, -- 'string', 'numeric', 'date', 'lookup'
    input_type VARCHAR(50) NOT NULL,
    output_type VARCHAR(50) NOT NULL,
    function_code TEXT NOT NULL, -- JavaScript or SQL
    test_cases JSONB, -- Input/output examples
    is_system_function BOOLEAN DEFAULT false, -- Built-in vs custom
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transformation_type ON transformation_functions(function_type);
```

#### mapping_execution_logs
```sql
CREATE TABLE mapping_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapping_config_id UUID NOT NULL REFERENCES mapping_configurations(id),
    file_upload_id UUID REFERENCES file_uploads(id),
    execution_start TIMESTAMP NOT NULL,
    execution_end TIMESTAMP,
    records_processed INTEGER DEFAULT 0,
    records_successful INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_summary JSONB, -- Common errors and counts
    sample_errors JSONB, -- First 10 errors for debugging
    performance_metrics JSONB, -- Avg time per record, memory usage
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mapping_exec_config ON mapping_execution_logs(mapping_config_id);
CREATE INDEX idx_mapping_exec_date ON mapping_execution_logs(execution_start);
```

#### validation_rules
```sql
CREATE TABLE validation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'irs_limit', 'format', 'business_logic'
    applies_to VARCHAR(100) NOT NULL, -- Field or record type
    rule_logic JSONB NOT NULL, -- Condition and validation logic
    error_message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'error', -- 'error', 'warning', 'info'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_validation_type ON validation_rules(rule_type);
CREATE INDEX idx_validation_active ON validation_rules(is_active);
```

### Example Mapping Rules JSON Structure

```json
{
  "field_mappings": [
    {
      "source_field": "employee_ssn",
      "destination_field": "participant_tin",
      "transformation": "format_ssn",
      "required": true
    },
    {
      "source_field": "gross_pay",
      "destination_field": "eligible_compensation",
      "transformation": "convert_to_cents",
      "required": true
    },
    {
      "source_field": "deferral_pct",
      "destination_field": "election_percentage",
      "transformation": "convert_to_decimal",
      "required": true
    }
  ],
  "conditional_mappings": [
    {
      "condition": "contribution_type == 'PRE_TAX'",
      "mappings": [
        {
          "source_value": "contribution_type",
          "destination_field": "deferral_code",
          "destination_value": "1"
        }
      ]
    },
    {
      "condition": "contribution_type == 'ROTH'",
      "mappings": [
        {
          "source_value": "contribution_type",
          "destination_field": "deferral_code",
          "destination_value": "2"
        }
      ]
    }
  ],
  "calculated_fields": [
    {
      "destination_field": "contribution_amount",
      "formula": "gross_pay * deferral_pct",
      "rounding": "cents"
    }
  ],
  "lookup_mappings": [
    {
      "source_field": "plan_code",
      "lookup_table": "plan_mappings",
      "lookup_key": "internal_plan_code",
      "lookup_value": "recordkeeper_plan_id",
      "destination_field": "plan_id"
    }
  ]
}
```

### Transformation Function Examples

Built-in transformation functions that SyncLinqs should provide:

**String Transformations**
- `format_ssn`: "123456789" → "123-45-6789"
- `remove_dashes`: "123-45-6789" → "123456789"
- `trim_whitespace`: " John " → "John"
- `uppercase`: "john" → "JOHN"
- `concatenate`: ["John", "Doe"] → "John Doe"

**Numeric Transformations**
- `convert_to_cents`: 100.50 → 10050
- `convert_to_dollars`: 10050 → 100.50
- `round_to_cents`: 100.555 → 100.56
- `convert_to_decimal`: 5.5 → 0.055 (percentage)
- `convert_from_decimal`: 0.055 → 5.5

**Date Transformations**
- `format_date_iso`: "01/15/2024" → "2024-01-15"
- `format_date_us`: "2024-01-15" → "01/15/2024"
- `parse_date`: Auto-detect format and normalize

**Validation Functions**
- `validate_ssn`: Check format and validity
- `validate_irs_limit`: Check against annual contribution limits
- `validate_email`: Email format validation
- `validate_positive`: Ensure value > 0

### Mapping Configuration UI Requirements

#### Self-Service Portal Features
1. **System Selection**
   - Choose source system (payroll provider)
   - Choose destination system (recordkeeper)
   - Select mapping type (contributions, employees, elections)

2. **Template Selection**
   - Browse pre-built templates
   - Preview template mappings
   - "Use Template" with ability to customize

3. **Field Mapping Interface**
   - Split-screen view: Source fields (left) | Destination fields (right)
   - Drag-and-drop or dropdown to map fields
   - Visual indicators for required vs optional fields
   - Color coding for mapped, unmapped, and error states

4. **Transformation Builder**
   - Select transformation function from dropdown
   - Preview transformation with sample data
   - Chain multiple transformations
   - Add custom JavaScript transformations (advanced)

5. **Testing & Validation**
   - Upload sample file
   - Preview mapped output
   - Validate against business rules
   - Show errors and warnings
   - "Dry run" mode before activating

6. **Version Control**
   - Save mapping versions
   - Compare versions
   - Rollback to previous version
   - Track who made changes and when

#### API Endpoints for Mapping

```
GET    /api/v1/mappings                      - List all mappings for organization
POST   /api/v1/mappings                      - Create new mapping
GET    /api/v1/mappings/:id                  - Get mapping details
PATCH  /api/v1/mappings/:id                  - Update mapping
DELETE /api/v1/mappings/:id                  - Delete mapping
POST   /api/v1/mappings/:id/test             - Test mapping with sample data
POST   /api/v1/mappings/:id/activate         - Activate mapping
POST   /api/v1/mappings/:id/deactivate       - Deactivate mapping

GET    /api/v1/mapping-templates             - List available templates
GET    /api/v1/mapping-templates/:id         - Get template details
POST   /api/v1/mappings/from-template/:id    - Create mapping from template

GET    /api/v1/field-definitions             - List all field definitions
GET    /api/v1/field-definitions/:system     - Get fields for specific system

GET    /api/v1/transformations               - List all transformation functions
GET    /api/v1/transformations/:id           - Get transformation details
POST   /api/v1/transformations/test          - Test transformation with input

GET    /api/v1/mapping-logs                  - Get mapping execution history
GET    /api/v1/mapping-logs/:id              - Get detailed execution log
```

### Mapping Service Implementation

Create `/src/services/MappingService.ts`:

```typescript
class MappingService {
  // Apply mapping configuration to source data
  async applyMapping(
    mappingConfigId: string,
    sourceData: any[]
  ): Promise<MappingResult> {
    // 1. Load mapping configuration
    // 2. Validate source data structure
    // 3. Apply field mappings
    // 4. Execute transformations
    // 5. Apply conditional logic
    // 6. Calculate derived fields
    // 7. Validate output
    // 8. Log execution metrics
    // 9. Return transformed data + errors
  }

  // Test mapping with sample data
  async testMapping(
    mappingConfigId: string,
    sampleData: any[]
  ): Promise<TestResult> {
    // Run mapping in dry-run mode
    // Return preview without persisting
  }

  // Create mapping from template
  async createFromTemplate(
    templateId: string,
    organizationId: string,
    customizations?: any
  ): Promise<MappingConfiguration> {
    // Clone template
    // Apply org-specific customizations
    // Save as new configuration
  }
}
```

### Pre-built Template Strategy

Launch with templates for most common combinations:

**Payroll Providers:**
- ADP Workforce Now
- Paychex Flex
- Gusto
- Paylocity
- UKG (Ultimate Kronos Group)

**Recordkeepers:**
- Fidelity NetBenefits
- Vanguard Retirement Plan Access
- Empower Retirement
- Principal
- TIAA

**Priority Templates (Phase 1):**
1. ADP → Fidelity
2. Paychex → Vanguard
3. Gusto → Empower
4. ADP → Vanguard
5. Paychex → Fidelity

Each template should be:
- Verified by SyncLinqs team with actual data
- Documented with field definitions
- Tested with edge cases
- Marked as "SyncLinqs Verified"

### Mapping Best Practices

**Performance:**
- Cache field definitions and transformation functions
- Use database transactions for mapping execution
- Process in batches (1,000 records at a time)
- Use parallel processing for large files

**Error Handling:**
- Continue processing on field-level errors
- Collect all errors, don't fail fast
- Provide detailed error messages with line numbers
- Store sample errors for debugging

**Security:**
- Never log PII in mapping execution logs
- Encrypt sensitive fields in mapped output
- Audit all mapping configuration changes
- Require approval for mappings touching PII

**Validation:**
- Validate before and after transformation
- Check IRS limits on contribution amounts
- Verify required fields are present
- Ensure data types match expectations

## Production-Ready Features

### Multi-Tenancy Architecture

#### Overview
SyncLinqs must support multiple organizations (customers) on a single infrastructure while maintaining complete data isolation, security, and performance.

#### Database Schema for Multi-Tenancy

**organizations table**
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- URL-friendly identifier
    organization_type VARCHAR(50) NOT NULL, -- 'customer', 'payroll_provider', 'recordkeeper'
    billing_plan VARCHAR(50) DEFAULT 'trial', -- 'trial', 'starter', 'professional', 'enterprise'
    subscription_status VARCHAR(50) DEFAULT 'active', -- 'active', 'suspended', 'cancelled'
    max_employees INTEGER,
    max_api_calls_per_month INTEGER,
    settings JSONB DEFAULT '{}', -- Organization-specific settings
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP -- Soft delete for data retention
);

CREATE INDEX idx_org_slug ON organizations(slug);
CREATE INDEX idx_org_status ON organizations(subscription_status) WHERE deleted_at IS NULL;
```

**users table**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255), -- NULL for SSO users
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) NOT NULL, -- 'admin', 'manager', 'user', 'viewer'
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

CREATE INDEX idx_user_org ON users(organization_id);
CREATE INDEX idx_user_email ON users(email);
```

**teams table** (optional, for larger organizations)
```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_team_id UUID REFERENCES teams(id), -- Hierarchical teams
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE team_members (
    team_id UUID NOT NULL REFERENCES teams(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member'
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (team_id, user_id)
);
```

#### Row-Level Security (RLS)
PostgreSQL RLS policies enforce tenant isolation at the database level:

```sql
-- Enable RLS on all tenant tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Create policy to restrict access to organization's data only
CREATE POLICY tenant_isolation_policy ON employees
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY tenant_isolation_policy ON contributions
    USING (organization_id = current_setting('app.current_organization_id')::UUID);
```

#### Application-Level Tenant Context
Every API request must include organization context:

```typescript
// Middleware to set tenant context
async function setTenantContext(req, res, next) {
  const user = req.user; // From JWT token
  const organizationId = user.organizationId;
  
  // Set PostgreSQL session variable
  await db.query('SET app.current_organization_id = $1', [organizationId]);
  
  // Add to request object
  req.organizationId = organizationId;
  
  next();
}

// All queries automatically filtered by organization_id
const employees = await db.employees.findMany({
  where: { organization_id: req.organizationId }
});
```

### Reconciliation Engine

#### Purpose
Daily reconciliation ensures data accuracy between payroll systems and recordkeepers, critical for ERISA compliance and DOL audits.

#### Database Schema

**reconciliation_reports table**
```sql
CREATE TABLE reconciliation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    reconciliation_date DATE NOT NULL,
    source_system VARCHAR(100) NOT NULL,
    destination_system VARCHAR(100) NOT NULL,
    total_records INTEGER NOT NULL,
    matched_records INTEGER DEFAULT 0,
    unmatched_source_records INTEGER DEFAULT 0,
    unmatched_destination_records INTEGER DEFAULT 0,
    amount_discrepancies INTEGER DEFAULT 0,
    total_source_amount DECIMAL(15,2),
    total_destination_amount DECIMAL(15,2),
    variance_amount DECIMAL(15,2),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'reconciled', 'discrepancies', 'failed'
    reconciled_by UUID REFERENCES users(id),
    reconciled_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(organization_id, reconciliation_date, source_system, destination_system)
);

CREATE INDEX idx_recon_org_date ON reconciliation_reports(organization_id, reconciliation_date);
CREATE INDEX idx_recon_status ON reconciliation_reports(status);
```

**reconciliation_items table**
```sql
CREATE TABLE reconciliation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_report_id UUID NOT NULL REFERENCES reconciliation_reports(id),
    employee_id UUID REFERENCES employees(id),
    contribution_id UUID REFERENCES contributions(id),
    match_status VARCHAR(50) NOT NULL, -- 'matched', 'source_only', 'destination_only', 'amount_mismatch'
    source_record JSONB, -- Original source data
    destination_record JSONB, -- Original destination data
    source_amount DECIMAL(15,2),
    destination_amount DECIMAL(15,2),
    variance_amount DECIMAL(15,2),
    discrepancy_reason TEXT,
    resolution_action VARCHAR(100), -- 'auto_corrected', 'manual_review', 'ignored'
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recon_item_report ON reconciliation_items(reconciliation_report_id);
CREATE INDEX idx_recon_item_status ON reconciliation_items(match_status);
```

#### Reconciliation Service

```typescript
class ReconciliationService {
  async performDailyReconciliation(organizationId: string, date: Date) {
    // 1. Fetch contributions sent to recordkeeper
    const sourceRecords = await this.getSourceRecords(organizationId, date);
    
    // 2. Fetch acknowledgments from recordkeeper
    const destRecords = await this.getDestinationRecords(organizationId, date);
    
    // 3. Match records by unique identifier (SSN, employee_id)
    const matchResults = await this.matchRecords(sourceRecords, destRecords);
    
    // 4. Identify discrepancies
    const discrepancies = this.findDiscrepancies(matchResults);
    
    // 5. Create reconciliation report
    const report = await this.createReport(organizationId, date, matchResults, discrepancies);
    
    // 6. Send alerts if discrepancies found
    if (discrepancies.length > 0) {
      await this.sendReconciliationAlert(organizationId, report);
    }
    
    return report;
  }
  
  private async matchRecords(source: any[], destination: any[]) {
    const matched = [];
    const sourceOnly = [];
    const destOnly = [];
    const amountMismatches = [];
    
    // Matching algorithm
    const sourceMap = new Map(source.map(r => [r.employeeId, r]));
    const destMap = new Map(destination.map(r => [r.participantId, r]));
    
    // Find matches and mismatches
    for (const [id, sourceRecord] of sourceMap) {
      const destRecord = destMap.get(id);
      
      if (!destRecord) {
        sourceOnly.push({ source: sourceRecord, destination: null });
      } else if (sourceRecord.amount !== destRecord.amount) {
        amountMismatches.push({ source: sourceRecord, destination: destRecord });
      } else {
        matched.push({ source: sourceRecord, destination: destRecord });
      }
      
      destMap.delete(id);
    }
    
    // Remaining destination records are destination-only
    for (const [id, destRecord] of destMap) {
      destOnly.push({ source: null, destination: destRecord });
    }
    
    return { matched, sourceOnly, destOnly, amountMismatches };
  }
}
```

#### Reconciliation API Endpoints

```
GET    /api/v1/reconciliation/reports              - List reconciliation reports
GET    /api/v1/reconciliation/reports/:id          - Get report details
POST   /api/v1/reconciliation/run                  - Trigger reconciliation
GET    /api/v1/reconciliation/items/:report_id     - Get discrepancy items
PATCH  /api/v1/reconciliation/items/:id/resolve    - Resolve discrepancy
GET    /api/v1/reconciliation/dashboard            - Reconciliation health metrics
```

### Error Handling & Retry Logic

#### Error Queue System

**error_queue table**
```sql
CREATE TABLE error_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    error_type VARCHAR(100) NOT NULL, -- 'mapping_error', 'validation_error', 'api_error', 'file_format_error'
    severity VARCHAR(20) DEFAULT 'error', -- 'critical', 'error', 'warning'
    source_system VARCHAR(100),
    destination_system VARCHAR(100),
    record_id UUID, -- Reference to original record
    error_data JSONB NOT NULL, -- Original failed record
    error_message TEXT NOT NULL,
    error_stack TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'retrying', 'resolved', 'failed_permanently', 'manual_review'
    resolution_notes TEXT,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_error_org_status ON error_queue(organization_id, status);
CREATE INDEX idx_error_retry ON error_queue(next_retry_at) WHERE status = 'pending';
```

**retry_logs table**
```sql
CREATE TABLE retry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_queue_id UUID NOT NULL REFERENCES error_queue(id),
    retry_attempt INTEGER NOT NULL,
    retry_at TIMESTAMP NOT NULL,
    retry_result VARCHAR(50), -- 'success', 'failed', 'transient_error'
    error_message TEXT,
    response_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_retry_error ON retry_logs(error_queue_id);
```

#### Retry Service

```typescript
class RetryService {
  async processRetryQueue() {
    const pendingRetries = await db.error_queue.findMany({
      where: {
        status: 'pending',
        next_retry_at: { lte: new Date() },
        retry_count: { lt: db.raw('max_retries') }
      }
    });
    
    for (const error of pendingRetries) {
      await this.retryFailedRecord(error);
    }
  }
  
  async retryFailedRecord(errorRecord: ErrorQueue) {
    try {
      // Update status
      await db.error_queue.update({
        where: { id: errorRecord.id },
        data: { 
          status: 'retrying',
          retry_count: errorRecord.retry_count + 1
        }
      });
      
      // Attempt to reprocess
      const result = await this.reprocessRecord(errorRecord);
      
      // Log retry
      await db.retry_logs.create({
        data: {
          error_queue_id: errorRecord.id,
          retry_attempt: errorRecord.retry_count + 1,
          retry_at: new Date(),
          retry_result: 'success',
          response_data: result
        }
      });
      
      // Mark as resolved
      await db.error_queue.update({
        where: { id: errorRecord.id },
        data: { status: 'resolved', resolved_at: new Date() }
      });
      
    } catch (error) {
      // Check if transient or permanent error
      const isTransient = this.isTransientError(error);
      
      if (isTransient && errorRecord.retry_count < errorRecord.max_retries) {
        // Schedule next retry with exponential backoff
        const nextRetryIn = Math.pow(2, errorRecord.retry_count) * 60; // Minutes
        
        await db.error_queue.update({
          where: { id: errorRecord.id },
          data: {
            status: 'pending',
            next_retry_at: new Date(Date.now() + nextRetryIn * 60000)
          }
        });
      } else {
        // Failed permanently, needs manual intervention
        await db.error_queue.update({
          where: { id: errorRecord.id },
          data: { 
            status: errorRecord.retry_count >= errorRecord.max_retries 
              ? 'failed_permanently' 
              : 'manual_review'
          }
        });
        
        // Send alert
        await this.alertPermanentFailure(errorRecord);
      }
      
      // Log retry
      await db.retry_logs.create({
        data: {
          error_queue_id: errorRecord.id,
          retry_attempt: errorRecord.retry_count + 1,
          retry_at: new Date(),
          retry_result: isTransient ? 'transient_error' : 'failed',
          error_message: error.message
        }
      });
    }
  }
  
  private isTransientError(error: any): boolean {
    // Network errors, timeouts, rate limits = transient
    const transientCodes = [408, 429, 500, 502, 503, 504];
    return transientCodes.includes(error.statusCode) || 
           error.code === 'ECONNREFUSED' ||
           error.code === 'ETIMEDOUT';
  }
}
```

#### Error Queue API Endpoints

```
GET    /api/v1/errors                    - List errors with filtering
GET    /api/v1/errors/:id                - Get error details
POST   /api/v1/errors/:id/retry          - Manual retry trigger
PATCH  /api/v1/errors/:id/resolve        - Mark as manually resolved
POST   /api/v1/errors/bulk-retry         - Bulk retry selected errors
GET    /api/v1/errors/stats              - Error statistics dashboard
```

### Notifications & Alerting System

#### Database Schema

**notifications table**
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID REFERENCES users(id), -- NULL for org-wide notifications
    notification_type VARCHAR(100) NOT NULL, -- 'sync_complete', 'sync_failed', 'reconciliation_discrepancy', 'error_threshold'
    severity VARCHAR(20) DEFAULT 'info', -- 'critical', 'error', 'warning', 'info', 'success'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(500), -- Deep link to relevant page
    metadata JSONB,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON notifications(user_id, is_read);
CREATE INDEX idx_notif_org ON notifications(organization_id, created_at);
```

**notification_preferences table**
```sql
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    channel VARCHAR(50) NOT NULL, -- 'email', 'sms', 'in_app', 'slack', 'webhook'
    notification_type VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    settings JSONB, -- Channel-specific settings (email address, phone, webhook URL)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, channel, notification_type)
);

CREATE INDEX idx_notif_pref_user ON notification_preferences(user_id);
```

**alert_rules table**
```sql
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(100) NOT NULL, -- 'error_rate', 'reconciliation_variance', 'sync_failure', 'api_latency'
    condition JSONB NOT NULL, -- Threshold conditions
    severity VARCHAR(20) DEFAULT 'warning',
    recipients JSONB NOT NULL, -- Array of user IDs or email addresses
    channels VARCHAR(50)[] DEFAULT ARRAY['email'], -- notification channels
    is_active BOOLEAN DEFAULT true,
    cooldown_minutes INTEGER DEFAULT 60, -- Prevent alert spam
    last_triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_org ON alert_rules(organization_id, is_active);
```

#### Notification Service

```typescript
class NotificationService {
  async sendNotification(notification: {
    organizationId: string;
    userId?: string;
    type: string;
    severity: 'critical' | 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
    actionUrl?: string;
    metadata?: any;
  }) {
    // 1. Create in-app notification
    const inAppNotif = await db.notifications.create({
      data: notification
    });
    
    // 2. Get user preferences
    const preferences = await this.getUserPreferences(notification.userId);
    
    // 3. Send via configured channels
    const promises = [];
    
    if (preferences.email?.enabled) {
      promises.push(this.sendEmail(notification));
    }
    
    if (preferences.sms?.enabled && notification.severity === 'critical') {
      promises.push(this.sendSMS(notification));
    }
    
    if (preferences.slack?.enabled) {
      promises.push(this.sendSlackMessage(notification));
    }
    
    if (preferences.webhook?.enabled) {
      promises.push(this.sendWebhook(notification));
    }
    
    await Promise.allSettled(promises);
    
    return inAppNotif;
  }
  
  async checkAlertRules(organizationId: string, metrics: any) {
    const activeRules = await db.alert_rules.findMany({
      where: { 
        organization_id: organizationId,
        is_active: true
      }
    });
    
    for (const rule of activeRules) {
      const shouldTrigger = this.evaluateRule(rule, metrics);
      
      if (shouldTrigger && this.canTrigger(rule)) {
        await this.triggerAlert(rule, metrics);
      }
    }
  }
  
  private canTrigger(rule: AlertRule): boolean {
    if (!rule.last_triggered_at) return true;
    
    const cooldownMs = rule.cooldown_minutes * 60 * 1000;
    const timeSinceLastTrigger = Date.now() - rule.last_triggered_at.getTime();
    
    return timeSinceLastTrigger > cooldownMs;
  }
  
  private async sendEmail(notification: any) {
    // Use SendGrid, AWS SES, or similar
    await emailService.send({
      to: notification.email,
      subject: notification.title,
      template: 'notification',
      data: {
        severity: notification.severity,
        message: notification.message,
        actionUrl: notification.actionUrl
      }
    });
  }
  
  private async sendSlackMessage(notification: any) {
    const color = {
      critical: 'danger',
      error: 'danger',
      warning: 'warning',
      info: '#2E5CFF',
      success: 'good'
    }[notification.severity];
    
    await slackClient.chat.postMessage({
      channel: notification.slackChannel,
      attachments: [{
        color,
        title: notification.title,
        text: notification.message,
        fields: notification.metadata ? 
          Object.entries(notification.metadata).map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true
          })) : []
      }]
    });
  }
}
```

#### Alert Rules Examples

```json
{
  "name": "High Error Rate Alert",
  "rule_type": "error_rate",
  "condition": {
    "metric": "error_percentage",
    "operator": "greater_than",
    "threshold": 5,
    "time_window_minutes": 15
  },
  "severity": "critical",
  "recipients": ["user_id_1", "user_id_2"],
  "channels": ["email", "sms", "slack"]
}

{
  "name": "Reconciliation Variance Alert",
  "rule_type": "reconciliation_variance",
  "condition": {
    "metric": "variance_amount",
    "operator": "greater_than",
    "threshold": 1000,
    "currency": "USD"
  },
  "severity": "error",
  "recipients": ["finance_team"],
  "channels": ["email", "slack"]
}

{
  "name": "Sync Failure Alert",
  "rule_type": "sync_failure",
  "condition": {
    "consecutive_failures": 3
  },
  "severity": "error",
  "recipients": ["ops_team"],
  "channels": ["email", "slack", "webhook"]
}
```

### Scheduled Jobs & Automation

#### Database Schema

**sync_jobs table**
```sql
CREATE TABLE sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    job_type VARCHAR(100) NOT NULL, -- 'contribution_sync', 'employee_sync', 'reconciliation', 'file_export'
    source_system VARCHAR(100),
    destination_system VARCHAR(100),
    schedule_cron VARCHAR(100), -- Cron expression
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    configuration JSONB, -- Job-specific config
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_job_org ON sync_jobs(organization_id);
CREATE INDEX idx_sync_job_next_run ON sync_jobs(next_run_at) WHERE is_active = true;
```

**job_executions table**
```sql
CREATE TABLE job_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_job_id UUID NOT NULL REFERENCES sync_jobs(id),
    execution_start TIMESTAMP NOT NULL DEFAULT NOW(),
    execution_end TIMESTAMP,
    status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed', 'partial'
    records_processed INTEGER DEFAULT 0,
    records_successful INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_summary TEXT,
    performance_metrics JSONB,
    triggered_by VARCHAR(50), -- 'schedule', 'manual', 'api', 'webhook'
    triggered_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_exec_job ON job_executions(sync_job_id);
CREATE INDEX idx_job_exec_status ON job_executions(status, execution_start);
```

#### Job Scheduler Service

```typescript
class JobSchedulerService {
  async scheduleCronJobs() {
    const activeJobs = await db.sync_jobs.findMany({
      where: { is_active: true }
    });
    
    for (const job of activeJobs) {
      this.scheduleJob(job);
    }
  }
  
  private scheduleJob(job: SyncJob) {
    cron.schedule(job.schedule_cron, async () => {
      await this.executeJob(job.id);
    }, {
      timezone: job.timezone
    });
  }
  
  async executeJob(jobId: string) {
    const job = await db.sync_jobs.findUnique({ where: { id: jobId } });
    
    // Create execution record
    const execution = await db.job_executions.create({
      data: {
        sync_job_id: jobId,
        execution_start: new Date(),
        status: 'running',
        triggered_by: 'schedule'
      }
    });
    
    try {
      let result;
      
      switch (job.job_type) {
        case 'contribution_sync':
          result = await this.syncContributions(job);
          break;
        case 'employee_sync':
          result = await this.syncEmployees(job);
          break;
        case 'reconciliation':
          result = await reconciliationService.performDailyReconciliation(
            job.organization_id, 
            new Date()
          );
          break;
        case 'file_export':
          result = await this.exportFiles(job);
          break;
      }
      
      // Update execution record
      await db.job_executions.update({
        where: { id: execution.id },
        data: {
          execution_end: new Date(),
          status: 'completed',
          records_processed: result.totalRecords,
          records_successful: result.successfulRecords,
          records_failed: result.failedRecords,
          performance_metrics: result.metrics
        }
      });
      
      // Update job's last/next run times
      await this.updateJobRunTimes(job);
      
      // Send completion notification
      await notificationService.sendNotification({
        organizationId: job.organization_id,
        type: 'job_completed',
        severity: 'success',
        title: `${job.name} completed`,
        message: `Processed ${result.totalRecords} records successfully`
      });
      
    } catch (error) {
      await db.job_executions.update({
        where: { id: execution.id },
        data: {
          execution_end: new Date(),
          status: 'failed',
          error_summary: error.message
        }
      });
      
      // Send failure notification
      await notificationService.sendNotification({
        organizationId: job.organization_id,
        type: 'job_failed',
        severity: 'error',
        title: `${job.name} failed`,
        message: error.message
      });
    }
  }
}
```

#### Scheduled Job API Endpoints

```
GET    /api/v1/jobs                     - List all scheduled jobs
POST   /api/v1/jobs                     - Create new scheduled job
GET    /api/v1/jobs/:id                 - Get job details
PATCH  /api/v1/jobs/:id                 - Update job configuration
DELETE /api/v1/jobs/:id                 - Delete job
POST   /api/v1/jobs/:id/run             - Trigger manual execution
GET    /api/v1/jobs/:id/executions      - Get job execution history
GET    /api/v1/jobs/:id/metrics         - Get job performance metrics
```

### Idempotency & Deduplication

#### Idempotency Keys

Every state-changing API request must include an idempotency key to prevent duplicate operations:

```typescript
// Middleware to handle idempotency
async function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers['idempotency-key'];
  
  if (!idempotencyKey && ['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(400).json({ 
      error: 'Idempotency-Key header required' 
    });
  }
  
  // Check if this operation was already performed
  const existing = await db.idempotency_records.findUnique({
    where: {
      organization_id_key: {
        organization_id: req.organizationId,
        idempotency_key: idempotencyKey
      }
    }
  });
  
  if (existing) {
    // Return cached response
    return res.status(existing.status_code).json(existing.response_data);
  }
  
  // Store key for this request
  req.idempotencyKey = idempotencyKey;
  next();
}
```

**idempotency_records table**
```sql
CREATE TABLE idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    idempotency_key VARCHAR(255) NOT NULL,
    request_path VARCHAR(500) NOT NULL,
    request_method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
    UNIQUE(organization_id, idempotency_key)
);

CREATE INDEX idx_idempotency_key ON idempotency_records(organization_id, idempotency_key);
CREATE INDEX idx_idempotency_expires ON idempotency_records(expires_at);
```

#### Deduplication Strategy

Prevent duplicate contributions from being processed:

```typescript
class DeduplicationService {
  async checkDuplicate(contribution: {
    organizationId: string;
    employeeId: string;
    amount: number;
    payPeriodEnd: Date;
    contributionType: string;
  }): Promise<boolean> {
    // Check for existing contribution with same attributes
    const existing = await db.contributions.findFirst({
      where: {
        organization_id: contribution.organizationId,
        employee_id: contribution.employeeId,
        amount: contribution.amount,
        pay_period_end: contribution.payPeriodEnd,
        contribution_type: contribution.contributionType,
        status: { not: 'cancelled' }
      }
    });
    
    return existing !== null;
  }
  
  async findPotentialDuplicates(organizationId: string): Promise<any[]> {
    // Find contributions with same employee, amount, and date
    const query = `
      SELECT 
        employee_id,
        amount,
        pay_period_end,
        COUNT(*) as duplicate_count,
        ARRAY_AGG(id) as contribution_ids
      FROM contributions
      WHERE organization_id = $1
        AND status != 'cancelled'
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY employee_id, amount, pay_period_end
      HAVING COUNT(*) > 1
    `;
    
    return db.query(query, [organizationId]);
  }
}
```

## Deployment Considerations

### Production Environment
- AWS RDS PostgreSQL (Multi-AZ for HA)
- AWS ECS/Fargate for containerized apps
- AWS ALB with SSL termination
- CloudWatch for logging and monitoring
- S3 for file storage
- ElastiCache Redis for caching and queues

### CI/CD Pipeline
- GitHub Actions for automated testing
- Terraform for infrastructure as code
- Automated database migrations on deploy
- Blue-green deployment strategy
- Rollback capability

### Monitoring & Alerts
- API response time and error rates
- Database connection pool utilization
- Queue depth and processing time
- Failed job notifications
- Security event alerts

## Questions to Consider

When implementing features, always ask:
1. What data needs to be encrypted?
2. Who should have access to this data?
3. How will this be audited?
4. What happens if this operation fails mid-way?
5. How will this scale with 10x the data?
6. What are the compliance implications?
7. How do we test this securely?

## Resources & Documentation

- ERISA Regulations: [DOL.gov](https://www.dol.gov/agencies/ebsa)
- IRS Contribution Limits: [IRS.gov](https://www.irs.gov/retirement-plans)
- PostgreSQL Docs: [postgresql.org](https://www.postgresql.org/docs/)
- Prisma Docs: [prisma.io/docs](https://www.prisma.io/docs)
- OWASP Security: [owasp.org](https://owasp.org/)

## Current Focus

When Claude Code starts working on SyncLinqs, prioritize in this order:

### Phase 1: Foundation (Week 1-2)
1. Multi-tenancy database schema with RLS policies
2. Authentication & authorization with JWT
3. Core API structure with proper middleware
4. Audit logging infrastructure

### Phase 2: Core Features (Week 3-4)
5. Mapping system architecture (database tables, services, APIs)
6. Pre-built mapping templates for top 3 integrations
7. Error queue and retry logic system
8. Field-level encryption for PII

### Phase 3: Production Readiness (Week 5-6)
9. Reconciliation engine with daily reports
10. Notification system (in-app, email, Slack)
11. Scheduled jobs and cron management
12. Idempotency and deduplication logic

### Phase 4: Launch Prep (Week 7-8)
13. Comprehensive testing (unit, integration, e2e)
14. Performance optimization and caching
15. Monitoring and alerting setup
16. Documentation and deployment automation

Remember: SyncLinqs handles financial data affecting people's retirement. Security, accuracy, and compliance are not optional. The mapping system enables scalability without custom code per integration. Reconciliation ensures accuracy and compliance. Error handling and retry logic ensure reliability in production.
