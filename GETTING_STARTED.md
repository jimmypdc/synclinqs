# Getting Started with Claude Code - SyncLinqs

## Initial Setup Prompt

Copy and paste this into Claude Code when you first start:

```
I'm building SyncLinqs, a 401(k) recordkeeper-to-payroll integration platform. Please read the CLAUDE.md file in this directory to understand the project requirements, tech stack, and architecture.

After reading CLAUDE.md, help me:

1. Set up the initial project structure following the recommended stack:
   - Node.js + TypeScript + Express
   - PostgreSQL with Prisma ORM
   - Docker for local development
   - Jest for testing
   
2. Create the foundational files:
   - package.json with all necessary dependencies
   - tsconfig.json with strict TypeScript settings
   - .env.example with required environment variables
   - docker-compose.yml for PostgreSQL and Redis
   - Prisma schema with core tables (organizations, employees, plans, contributions, audit_logs)
   - Basic Express server with authentication middleware
   
3. Implement security-first patterns:
   - Environment-based configuration
   - Request validation with Zod
   - Structured logging with Winston
   - Error handling middleware
   - Rate limiting
   
4. Set up the development workflow:
   - ESLint and Prettier configurations
   - Husky pre-commit hooks
   - Jest test setup
   - npm scripts for common tasks

Please start by creating the project structure and initial files. Ask me questions if you need clarification on any requirements.
```

## Alternative: Focused Setup Prompts

If you want to start with specific components, use these targeted prompts:

### Database Schema First
```
Read CLAUDE.md and help me create a comprehensive Prisma schema for SyncLinqs. Include:
- Core tables: organizations, employees, plans, contributions, deferral_elections, loans, integrations, audit_logs
- Proper relationships and foreign keys
- Encrypted fields for PII (SSN, bank accounts)
- Indexes for performance
- Soft delete support
- Audit columns (created_at, updated_at, created_by, updated_by)

Follow PostgreSQL best practices and compliance requirements outlined in CLAUDE.md.
```

### API Layer First
```
Read CLAUDE.md and help me build the REST API foundation:
1. Express server with TypeScript
2. Authentication middleware (JWT-based)
3. Route structure for contributions, employees, and integrations
4. Request validation using Zod
5. Error handling middleware with proper HTTP status codes
6. Rate limiting per client
7. Structured logging

Start with the contributions API as the core feature.
```

### Security & Compliance First
```
Read CLAUDE.md and help me implement the security and compliance foundations:
1. Field-level encryption setup for PII
2. Audit logging system that tracks all data access
3. Role-based access control (RBAC) middleware
4. Input validation and sanitization
5. Secrets management integration (HashiCorp Vault or AWS Secrets Manager)
6. SQL injection prevention patterns
7. Rate limiting and DDoS protection

Focus on ERISA and SOC 2 compliance requirements.
```

### Testing Setup First
```
Read CLAUDE.md and set up a comprehensive testing framework:
1. Jest configuration for unit and integration tests
2. Supertest for API endpoint testing
3. Test database setup with Docker
4. Factory pattern for test data generation
5. Mock data for recordkeepers and payroll systems
6. Example tests for contributions API
7. Security testing scenarios (SQL injection, XSS)

Create a solid testing foundation before we build features.
```

## Working with Claude Code

### Starting a Session
```bash
# Navigate to your project directory
cd C:\Users\jimpo\projects\projectmanagement

# Start Claude Code
claude
```

### Useful Claude Code Commands
```
/help              - Show all available commands
/add <file>        - Add file to context
/config            - View/edit Claude Code settings
/clear             - Clear conversation history
/quit              - Exit Claude Code

# When working on features:
"Read CLAUDE.md and implement the contributions API endpoint"
"Add validation for IRS contribution limits"
"Write tests for the employee creation endpoint"
"Help me debug this database query performance issue"
```

### Best Practices with Claude Code

1. **Always reference CLAUDE.md**: Start prompts with "Based on CLAUDE.md..." to keep Claude aligned with your architecture

2. **Be specific about requirements**: 
   - "Create a POST endpoint for contributions with Zod validation"
   - Not just "create an API"

3. **Request security reviews**:
   - "Review this code for SQL injection vulnerabilities"
   - "Check if this follows the security patterns in CLAUDE.md"

4. **Ask for explanations**:
   - "Explain why you chose this encryption approach"
   - "What are the compliance implications of this design?"

5. **Iterate incrementally**:
   - Build one feature at a time
   - Test thoroughly before moving on
   - Keep referencing the architecture principles

### Example Development Flow

```bash
# Session 1: Project Setup
claude
> "Read CLAUDE.md and set up the initial project structure with all configuration files"

# Session 2: Database Schema  
claude
> "Based on CLAUDE.md, create the Prisma schema with all core tables and relationships"

# Session 3: API Development
claude
> "Implement the contributions POST endpoint with validation, following patterns in CLAUDE.md"

# Session 4: Security
claude  
> "Add field-level encryption for employee PII following CLAUDE.md security requirements"

# Session 5: Testing
claude
> "Write comprehensive tests for the contributions API, including security tests"
```

## Environment Setup Checklist

Before starting with Claude Code, ensure you have:

- [ ] PostgreSQL installed (or Docker)
- [ ] Node.js 18+ installed
- [ ] Git initialized in project directory
- [ ] VS Code (or preferred editor) open
- [ ] CLAUDE.md file in project root
- [ ] .gitignore created (include .env, node_modules)
- [ ] README.md for project documentation

## Next Steps

1. Place CLAUDE.md in your project root directory
2. Start Claude Code: `claude`
3. Use one of the prompts above to begin
4. Let Claude Code guide you through implementation
5. Review generated code for security and compliance
6. Test thoroughly at each step

## Tips for Success

- **Keep sessions focused**: Work on one component per session
- **Review all generated code**: Claude Code is powerful but always review for your specific requirements
- **Save important context**: Update CLAUDE.md as your architecture evolves
- **Use version control**: Commit frequently with clear messages
- **Test security early**: Don't wait until the end to validate security controls

## Getting Help

If Claude Code seems confused or off-track:
- Use `/clear` to start fresh
- Explicitly reference CLAUDE.md again
- Break your request into smaller, more specific steps
- Share error messages and logs for better debugging

Remember: SyncLinqs handles people's retirement savings. Take the time to do it right!
