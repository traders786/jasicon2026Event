import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function main() {
  console.log('--- Provisioning Role-Based Test Accounts ---');

  // 1. Super Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@eventcheck.local' },
    update: { role: 'ADMIN', isActive: true, passwordHash: hashPassword('Admin123!') },
    create: {
      name: 'Dr. System Administrator',
      email: 'admin@eventcheck.local',
      passwordHash: hashPassword('Admin123!'),
      role: 'ADMIN',
      isActive: true,
    },
  });
  await prisma.user.upsert({
    where: { email: 'admin@jasicon2026.com' },
    update: { role: 'ADMIN', isActive: true, passwordHash: hashPassword('Admin123!') },
    create: {
      name: 'Dr. System Administrator',
      email: 'admin@jasicon2026.com',
      passwordHash: hashPassword('Admin123!'),
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log(`[Super Admin] ${admin.name} (admin@eventcheck.local / admin@jasicon2026.com) [Pass: Admin123!]`);

  // 2. Desk Operator (Registration Desk)
  const operator = await prisma.user.upsert({
    where: { email: 'desk@eventcheck.local' },
    update: { role: 'OPERATOR', isActive: true, passwordHash: hashPassword('Desk123!') },
    create: {
      name: 'Registration Desk Operator',
      email: 'desk@eventcheck.local',
      passwordHash: hashPassword('Desk123!'),
      role: 'OPERATOR',
      isActive: true,
    },
  });
  await prisma.user.upsert({
    where: { email: 'desk@jasicon2026.com' },
    update: { role: 'OPERATOR', isActive: true, passwordHash: hashPassword('Desk123!') },
    create: {
      name: 'Registration Desk Operator',
      email: 'desk@jasicon2026.com',
      passwordHash: hashPassword('Desk123!'),
      role: 'OPERATOR',
      isActive: true,
    },
  });
  console.log(`[Desk Operator] ${operator.name} (desk@eventcheck.local / desk@jasicon2026.com) [Pass: Desk123!]`);

  // 3. Catering / Food Vendor
  const vendor = await prisma.user.upsert({
    where: { email: 'caterer@eventcheck.local' },
    update: { role: 'VENDOR', isActive: true, passwordHash: hashPassword('Vendor123!') },
    create: {
      name: 'Executive Catering Staff',
      email: 'caterer@eventcheck.local',
      passwordHash: hashPassword('Vendor123!'),
      role: 'VENDOR',
      isActive: true,
    },
  });
  await prisma.user.upsert({
    where: { email: 'caterer@jasicon2026.com' },
    update: { role: 'VENDOR', isActive: true, passwordHash: hashPassword('Vendor123!') },
    create: {
      name: 'Executive Catering Staff',
      email: 'caterer@jasicon2026.com',
      passwordHash: hashPassword('Vendor123!'),
      role: 'VENDOR',
      isActive: true,
    },
  });
  console.log(`[Vendor] ${vendor.name} (caterer@eventcheck.local / caterer@jasicon2026.com) [Pass: Vendor123!]`);

  console.log('\nAll role accounts are provisioned and active.');
}

main().finally(() => prisma.$disconnect());
