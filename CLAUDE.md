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

### Scalability
1. **Stateless APIs**: All state in database or cache, enable horizontal scaling
2. **Connection Pooling**: Optimize database connections (PgBouncer)
3. **Caching**: Redis for frequently accessed reference data
4. **Async Processing**: Heavy operations queued, never block API responses

### Compliance Requirements
1. **ERISA Compliance**: Maintain participant records per DOL requirements
2. **SOC 2 Type II**: Design with SOC 2 controls in mind
3. **Data Retention**: Implement 7-year retention policy with automated archival
4. **Right to Delete**: Support CCPA/GDPR deletion requests while maintaining compliance

## Database Schema Overview

### Core Tables
- `organizations` - Payroll providers and recordkeepers
- `employees` - Plan participants with encrypted PII
- `plans` - 401(k) plan configurations
- `contributions` - Contribution records with amounts and dates
- `deferral_elections` - Employee deferral percentage choices
- `loans` - Active loan records and repayment schedules
- `integrations` - API credentials and connection configs (encrypted)
- `audit_logs` - Comprehensive audit trail
- `file_uploads` - Tracking for batch file processing

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
    /middleware   - Auth, validation, error handling
  /services       - Business logic layer
  /repositories   - Database access layer
  /models         - Data models and types
  /utils          - Helper functions
  /config         - Configuration management
  /workers        - Background job processors
/tests
  /unit
  /integration
  /e2e
/prisma
  /migrations     - Database migrations
  schema.prisma   - Database schema definition
/scripts          - Utility scripts
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

### Processing Batch Files
1. Store file metadata in `file_uploads` table
2. Queue processing job with Bull
3. Parse and validate file contents
4. Process in transactions (rollback on error)
5. Generate reconciliation report
6. Update file status and log results

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
3. Transform to recordkeeper format
4. Transmit to recordkeeper
5. Receive confirmation
6. Update internal records
7. Generate reports and notifications

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

When Claude Code starts working on SyncLinqs, prioritize:
1. Setting up the foundational database schema
2. Implementing secure authentication and authorization
3. Building core API endpoints with proper validation
4. Setting up comprehensive audit logging
5. Implementing encryption for sensitive fields

Remember: SyncLinqs handles financial data affecting people's retirement. Security, accuracy, and compliance are not optional.
