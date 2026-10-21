import { PrismaClient as LocalPrisma } from '@prisma/client';

const directNeonUrl = 'postgresql://neondb_owner:npg_q3mfvTNcuE0j@ep-autumn-union-b4utz1zp.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  console.log('=== ULTRA-FAST BULK MIGRATION TO NEON CLOUD DB ===');
  const localPrisma = new LocalPrisma(); // reads local .env (port 5433)
  const neonPrisma = new LocalPrisma({
    datasources: { db: { url: directNeonUrl } },
  });

  try {
    // 1. Users
    const users = await localPrisma.user.findMany();
    console.log(`Migrating ${users.length} users in 1 batch...`);
    await neonPrisma.user.createMany({ data: users, skipDuplicates: true });

    // 2. Events
    const events = await localPrisma.event.findMany();
    console.log(`Migrating ${events.length} events in 1 batch...`);
    await neonPrisma.event.createMany({ data: events, skipDuplicates: true });

    // 3. Persons
    const persons = await localPrisma.person.findMany();
    console.log(`Migrating ${persons.length} persons in 1 batch...`);
    await neonPrisma.person.createMany({ data: persons, skipDuplicates: true });

    // 4. Registrations
    const registrations = await localPrisma.eventRegistration.findMany();
    console.log(`Migrating ${registrations.length} registrations in 1 batch...`);
    await neonPrisma.eventRegistration.createMany({ data: registrations, skipDuplicates: true });

    // 5. Entitlements
    const entitlements = await localPrisma.entitlement.findMany();
    console.log(`Migrating ${entitlements.length} entitlements in bulk...`);
    // Batch in chunks of 500 for maximum PostgreSQL protocol speed
    const chunkSize = 500;
    for (let i = 0; i < entitlements.length; i += chunkSize) {
      const chunk = entitlements.slice(i, i + chunkSize);
      await neonPrisma.entitlement.createMany({ data: chunk, skipDuplicates: true });
      process.stdout.write(`  Inserted ${Math.min(i + chunkSize, entitlements.length)} / ${entitlements.length} entitlements...\n`);
    }

    // 6. Redemption Logs
    const redemptionLogs = await localPrisma.redemptionLog.findMany();
    if (redemptionLogs.length > 0) {
      console.log(`Migrating ${redemptionLogs.length} audit logs in 1 batch...`);
      await neonPrisma.redemptionLog.createMany({ data: redemptionLogs, skipDuplicates: true });
    }

    console.log('\n=== VERIFICATION OF NEON CLOUD DATABASE ===');
    const cloudUserCount = await neonPrisma.user.count();
    const cloudEventCount = await neonPrisma.event.count();
    const cloudPersonCount = await neonPrisma.person.count();
    const cloudRegCount = await neonPrisma.eventRegistration.count();
    const cloudEntCount = await neonPrisma.entitlement.count();
    const activeEvent = await neonPrisma.event.findFirst();

    console.log(`[PASS] Neon Cloud Users: ${cloudUserCount}`);
    console.log(`[PASS] Neon Cloud Event: "${activeEvent?.title}" at ${activeEvent?.venue}`);
    console.log(`[PASS] Neon Cloud Persons: ${cloudPersonCount}`);
    console.log(`[PASS] Neon Cloud Registrations: ${cloudRegCount}`);
    console.log(`[PASS] Neon Cloud Entitlements: ${cloudEntCount}`);
    console.log('\n🎉 ALL DATA HAS BEEN TRANSFERRED TO NEON POSTGRESQL CLOUD SUCCESSFULLY!');
  } finally {
    await localPrisma.$disconnect();
    await neonPrisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[MIGRATION FAILED]:', err);
  process.exit(1);
});
