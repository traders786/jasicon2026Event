import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const neonUrl = 'postgresql://neondb_owner:npg_q3mfvTNcuE0j@ep-autumn-union-b4utz1zp.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

const prisma = new PrismaClient({
  datasources: {
    db: { url: neonUrl },
  },
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function main() {
  console.log('--- Provisioning Users to Neon Cloud DB ---');

  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VENDOR';`);
    console.log('✓ Ensured VENDOR role enum exists in Neon PostgreSQL');
  } catch (e) {
    console.log('Role enum alter note:', e.message);
  }

  // 1. Super Admin
  const adminPass = hashPassword('Admin123!');
  await prisma.user.upsert({
    where: { email: 'admin@jasicon2026.com' },
    update: { role: 'ADMIN', isActive: true, passwordHash: adminPass, name: 'Dr. System Administrator' },
    create: {
      name: 'Dr. System Administrator',
      email: 'admin@jasicon2026.com',
      passwordHash: adminPass,
      role: 'ADMIN',
      isActive: true,
    },
  });
  await prisma.user.upsert({
    where: { email: 'admin@eventcheck.local' },
    update: { role: 'ADMIN', isActive: true, passwordHash: adminPass, name: 'Dr. System Administrator' },
    create: {
      name: 'Dr. System Administrator',
      email: 'admin@eventcheck.local',
      passwordHash: adminPass,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('✓ Admin provisioned: admin@jasicon2026.com & admin@eventcheck.local [Password: Admin123!]');

  // 2. Desk Operator
  const deskPass = hashPassword('Desk123!');
  await prisma.user.upsert({
    where: { email: 'desk@jasicon2026.com' },
    update: { role: 'OPERATOR', isActive: true, passwordHash: deskPass, name: 'Registration Desk Operator' },
    create: {
      name: 'Registration Desk Operator',
      email: 'desk@jasicon2026.com',
      passwordHash: deskPass,
      role: 'OPERATOR',
      isActive: true,
    },
  });
  await prisma.user.upsert({
    where: { email: 'desk@eventcheck.local' },
    update: { role: 'OPERATOR', isActive: true, passwordHash: deskPass, name: 'Registration Desk Operator' },
    create: {
      name: 'Registration Desk Operator',
      email: 'desk@eventcheck.local',
      passwordHash: deskPass,
      role: 'OPERATOR',
      isActive: true,
    },
  });
  await prisma.user.upsert({
    where: { email: 'scanner1@eventcheck.local' },
    update: { role: 'OPERATOR', isActive: true, passwordHash: deskPass, name: 'Registration Desk Operator' },
    create: {
      name: 'Registration Desk Operator',
      email: 'scanner1@eventcheck.local',
      passwordHash: deskPass,
      role: 'OPERATOR',
      isActive: true,
    },
  });
  console.log('✓ Desk Operator provisioned: desk@jasicon2026.com & desk@eventcheck.local & scanner1@eventcheck.local [Password: Desk123!]');

  // 3. Catering Vendor / Scanner
  const vendorPass = hashPassword('Vendor123!');
  await prisma.user.upsert({
    where: { email: 'caterer@jasicon2026.com' },
    update: { role: 'VENDOR', isActive: true, passwordHash: vendorPass, name: 'Executive Catering Staff' },
    create: {
      name: 'Executive Catering Staff',
      email: 'caterer@jasicon2026.com',
      passwordHash: vendorPass,
      role: 'VENDOR',
      isActive: true,
    },
  });
  await prisma.user.upsert({
    where: { email: 'caterer@eventcheck.local' },
    update: { role: 'VENDOR', isActive: true, passwordHash: vendorPass, name: 'Executive Catering Staff' },
    create: {
      name: 'Executive Catering Staff',
      email: 'caterer@eventcheck.local',
      passwordHash: vendorPass,
      role: 'VENDOR',
      isActive: true,
    },
  });
  console.log('✓ Catering Vendor provisioned: caterer@jasicon2026.com & caterer@eventcheck.local [Password: Vendor123!]');

  const allUsers = await prisma.user.findMany({
    select: { email: true, name: true, role: true, isActive: true },
  });
  console.log('\n--- Active Users in Neon Cloud DB ---');
  console.table(allUsers);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
