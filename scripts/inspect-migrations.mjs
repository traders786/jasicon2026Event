import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('=== INDEXES ON event_registrations ===');
  const indexes = await prisma.$queryRawUnsafe(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'event_registrations'
  `);
  console.log(JSON.stringify(indexes, null, 2));

  console.log('\n=== TABLES IN PUBLIC SCHEMA ===');
  const tables = await prisma.$queryRawUnsafe(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  console.log(JSON.stringify(tables, null, 2));
}

main().finally(() => prisma.$disconnect());
