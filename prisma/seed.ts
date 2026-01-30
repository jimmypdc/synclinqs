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
  const employees = [
    { number: 'EMP001', ssn: '123456789', firstName: 'John', lastName: 'Doe', hireDate: '2020-03-15' },
    { number: 'EMP002', ssn: '987654321', firstName: 'Jane', lastName: 'Smith', hireDate: '2021-06-01' },
    { number: 'EMP003', ssn: '456789123', firstName: 'Bob', lastName: 'Johnson', hireDate: '2022-01-10' },
  ];

  for (const emp of employees) {
    await prisma.employee.create({
      data: {
        organizationId: payrollProvider.id,
        planId: plan.id,
        employeeNumber: emp.number,
        ssnEncrypted: encrypt(emp.ssn),
        firstNameEncrypted: encrypt(emp.firstName),
        lastNameEncrypted: encrypt(emp.lastName),
        hireDate: new Date(emp.hireDate),
        createdBy: adminUser.id,
      },
    });
  }

  console.log('Created', employees.length, 'employees');

  // Create an integration
  const integration = await prisma.integration.create({
    data: {
      organizationId: payrollProvider.id,
      name: 'Retirement Solutions SFTP',
      type: 'SFTP',
      configEncrypted: encrypt(JSON.stringify({
        host: 'sftp.retirementsolutions.com',
        port: 22,
        username: 'acme_upload',
        directory: '/incoming/contributions',
      })),
      status: 'ACTIVE',
      createdBy: adminUser.id,
    },
  });

  console.log('Created integration:', integration.name);

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
