import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'dev-encryption-key-32-bytes-ok';

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'utf-8').subarray(0, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Check if data already exists
  const existingOrg = await prisma.organization.findFirst();
  if (existingOrg) {
    console.log('Database already has data. Skipping seed to avoid duplicates.');
    console.log('To re-seed, run: npx prisma migrate reset');
    return;
  }

  // Create organizations
  const payrollProvider = await prisma.organization.create({
    data: {
      name: 'Acme Payroll Services',
      type: 'PAYROLL_PROVIDER',
      status: 'ACTIVE',
    },
  });

  const recordkeeper = await prisma.organization.create({
    data: {
      name: 'Retirement Solutions Inc',
      type: 'RECORDKEEPER',
      status: 'ACTIVE',
    },
  });

  console.log('Created organizations:', payrollProvider.name, recordkeeper.name);

  // Create admin user
  const passwordHash = await bcrypt.hash('Admin123!', 12);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@acmepayroll.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      organizationId: payrollProvider.id,
    },
  });

  console.log('Created admin user:', adminUser.email);

  // Create a 401(k) plan
  const plan = await prisma.plan.create({
    data: {
      name: 'Acme 401(k) Plan',
      planNumber: 'ACME-401K-2024',
      organizationId: payrollProvider.id,
      effectiveDate: new Date('2024-01-01'),
      employeeContributionLimit: 2300000, // $23,000 in cents (2024 IRS limit)
      employerMatchLimit: 690000, // $6,900 in cents
      catchUpContributionLimit: 765000, // $7,650 in cents
      createdBy: adminUser.id,
    },
  });

  console.log('Created plan:', plan.name);

  // Create sample employees
  const employeesData = [
    { number: 'EMP001', ssn: '123456789', firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', hireDate: '2020-03-15' },
    { number: 'EMP002', ssn: '987654321', firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com', hireDate: '2021-06-01' },
    { number: 'EMP003', ssn: '456789123', firstName: 'Bob', lastName: 'Johnson', email: 'bob.johnson@example.com', hireDate: '2022-01-10' },
    { number: 'EMP004', ssn: '321654987', firstName: 'Alice', lastName: 'Williams', email: 'alice.w@example.com', hireDate: '2021-09-20' },
    { number: 'EMP005', ssn: '654987321', firstName: 'Charlie', lastName: 'Brown', email: 'charlie.b@example.com', hireDate: '2023-02-14' },
    { number: 'EMP006', ssn: '789123456', firstName: 'Diana', lastName: 'Ross', email: 'diana.r@example.com', hireDate: '2020-07-01' },
    { number: 'EMP007', ssn: '147258369', firstName: 'Edward', lastName: 'Miller', email: 'edward.m@example.com', hireDate: '2022-11-15' },
    { number: 'EMP008', ssn: '258369147', firstName: 'Fiona', lastName: 'Davis', email: 'fiona.d@example.com', hireDate: '2019-05-30' },
    { number: 'EMP009', ssn: '369147258', firstName: 'George', lastName: 'Wilson', email: 'george.w@example.com', hireDate: '2023-08-07' },
    { number: 'EMP010', ssn: '741852963', firstName: 'Helen', lastName: 'Taylor', email: 'helen.t@example.com', hireDate: '2021-03-22' },
  ];

  const employees = [];
  for (const emp of employeesData) {
    const employee = await prisma.employee.create({
      data: {
        organizationId: payrollProvider.id,
        planId: plan.id,
        employeeNumber: emp.number,
        ssnEncrypted: encrypt(emp.ssn),
        firstNameEncrypted: encrypt(emp.firstName),
        lastNameEncrypted: encrypt(emp.lastName),
        emailEncrypted: encrypt(emp.email),
        hireDate: new Date(emp.hireDate),
        createdBy: adminUser.id,
      },
    });
    employees.push(employee);
  }

  console.log('Created', employees.length, 'employees');

  // Create contributions for the last 6 months
  const now = new Date();
  const contributionStatuses = ['PENDING', 'VALIDATED', 'SUBMITTED', 'CONFIRMED', 'CONFIRMED', 'CONFIRMED'] as const;

  for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
    const payrollDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 15);

    for (const employee of employees) {
      // Random contribution amounts
      const preTax = Math.floor(Math.random() * 100000) + 50000; // $500-$1500
      const roth = Math.random() > 0.6 ? Math.floor(Math.random() * 30000) : 0; // 40% have Roth
      const match = Math.floor(preTax * 0.5); // 50% match

      await prisma.contribution.create({
        data: {
          employeeId: employee.id,
          planId: plan.id,
          payrollDate,
          employeePreTax: preTax,
          employeeRoth: roth,
          employerMatch: match,
          employerNonMatch: 0,
          status: contributionStatuses[monthOffset] || 'CONFIRMED',
          createdBy: adminUser.id,
        },
      });
    }
  }

  console.log('Created contributions for 6 months');

  // Create integrations
  const integrations = [
    {
      name: 'Retirement Solutions SFTP',
      type: 'SFTP' as const,
      config: { host: 'sftp.retirementsolutions.com', port: 22, username: 'acme_upload', directory: '/incoming/contributions' },
      status: 'ACTIVE' as const,
      lastSyncAt: new Date(Date.now() - 3600000), // 1 hour ago
      lastSyncStatus: 'SUCCESS',
    },
    {
      name: 'Fidelity REST API',
      type: 'REST_API' as const,
      config: { baseUrl: 'https://api.fidelity.com/v1', clientId: 'acme-client' },
      status: 'ACTIVE' as const,
      lastSyncAt: new Date(Date.now() - 7200000), // 2 hours ago
      lastSyncStatus: 'SUCCESS',
    },
    {
      name: 'Vanguard SOAP Service',
      type: 'SOAP' as const,
      config: { wsdlUrl: 'https://services.vanguard.com/ws/contributions?wsdl' },
      status: 'ERROR' as const,
      lastSyncAt: new Date(Date.now() - 86400000), // 1 day ago
      lastSyncStatus: 'FAILED',
    },
  ];

  for (const int of integrations) {
    await prisma.integration.create({
      data: {
        organizationId: payrollProvider.id,
        name: int.name,
        type: int.type,
        configEncrypted: encrypt(JSON.stringify(int.config)),
        status: int.status,
        lastSyncAt: int.lastSyncAt,
        lastSyncStatus: int.lastSyncStatus,
        createdBy: adminUser.id,
      },
    });
  }

  console.log('Created', integrations.length, 'integrations');

  // Create deferral elections
  for (const employee of employees) {
    await prisma.deferralElection.create({
      data: {
        employeeId: employee.id,
        preTaxPercent: Math.floor(Math.random() * 800) + 200, // 2-10%
        rothPercent: Math.random() > 0.5 ? Math.floor(Math.random() * 300) : 0, // 50% have Roth
        effectiveDate: new Date('2024-01-01'),
        status: 'ACTIVE',
        createdBy: adminUser.id,
      },
    });
  }

  console.log('Created deferral elections');

  // Create some audit logs
  const actions = ['LOGIN', 'CREATE_EMPLOYEE', 'UPDATE_CONTRIBUTION', 'SYNC_STARTED', 'SYNC_COMPLETED'];
  const entityTypes = ['User', 'Employee', 'Contribution', 'Integration'];

  for (let i = 0; i < 20; i++) {
    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: actions[Math.floor(Math.random() * actions.length)],
        entityType: entityTypes[Math.floor(Math.random() * entityTypes.length)],
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)), // Last 7 days
      },
    });
  }

  console.log('Created audit logs');

  console.log('\n=== Seeding completed successfully! ===');
  console.log('Login credentials: admin@acmepayroll.com / Admin123!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
