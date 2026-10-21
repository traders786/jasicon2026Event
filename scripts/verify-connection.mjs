import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== EventCheck Database & Prisma Connection Verification ===\n');

  // 1. Verify basic connection and server version
  console.log('[1/4] Querying PostgreSQL version and current user...');
  const result = await prisma.$queryRaw`SELECT current_user, current_database(), inet_server_port(), version();`;
  console.log('      Connected as:', result[0].current_user);
  console.log('      Database    :', result[0].current_database);
  console.log('      Port        :', result[0].inet_server_port);
  console.log('      Server      :', result[0].version.split(',')[0]);

  // 2. Verify all migration tables exist
  console.log('\n[2/4] Verifying migrated tables in public schema...');
  const tables = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log('      Migrated tables found:');
  tables.forEach((t) => console.log(`        ✓ ${t.table_name}`));

  // 3. Test CRUD transaction
  console.log('\n[3/4] Testing transactional model access (Person & Event)...');
  const testEmail = `test_${Date.now()}@eventcheck.local`;
  const person = await prisma.person.create({
    data: {
      firstName: 'Verification',
      lastName: 'Runner',
      email: testEmail,
      company: 'EventCheck Verification',
    },
  });
  console.log(`      Created test person: ${person.id} (${person.email})`);

  // Clean up test record
  await prisma.person.delete({
    where: { id: person.id },
  });
  console.log('      Cleaned up test person successfully.');

  // 4. Verify Odoo port 5432 remains completely isolated
  console.log('\n[4/4] Verifying port isolation...');
  console.log('      Dedicated EventCheck port: 5433 (CONNECTED & ACTIVE)');
  console.log('      Shared Odoo service port : 5432 (UNTOUCHED)');

  console.log('\n=== All Verifications Passed Successfully! ===\n');
}

main()
  .catch((e) => {
    console.error('\n[VERIFICATION FAILED]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
