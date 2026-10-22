import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VENDOR';`);
    console.log('[DB] Role enum updated with VENDOR successfully.');
  } catch (err) {
    console.error('[DB] Error altering Role enum:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
