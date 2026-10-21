import { PrismaClient } from '@prisma/client';

const directUrl = 'postgresql://neondb_owner:npg_q3mfvTNcuE0j@ep-autumn-union-b4utz1zp.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';
const pooledUrl = 'postgresql://neondb_owner:npg_q3mfvTNcuE0j@ep-autumn-union-b4utz1zp-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  console.log('Testing connection to Neon cloud PostgreSQL...');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: directUrl,
      },
    },
  });

  try {
    const res = await prisma.$queryRawUnsafe('SELECT version()');
    console.log('[SUCCESS] Connected to Neon PostgreSQL cloud instance!');
    console.log(res[0]);
  } catch (err) {
    console.error('[ERROR] Failed to connect:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
