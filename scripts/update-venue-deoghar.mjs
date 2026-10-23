import { PrismaClient } from '@prisma/client';

const localUrl = 'postgresql://eventcheck_app:1bd7fc63a69de0c74f7a55970adbe054fbde26d411dfaea6@127.0.0.1:5433/eventcheck_dev?schema=public';
const neonUrl = 'postgresql://neondb_owner:npg_q3mfvTNcuE0j@ep-autumn-union-b4utz1zp.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function updateDb(url, label) {
  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });

  try {
    const events = await prisma.event.findMany();
    console.log(`[${label}] Found ${events.length} event(s):`, events.map(e => ({ id: e.id, title: e.title, venue: e.venue })));

    for (const ev of events) {
      const newVenue = ev.venue.replace(/Ranchi/gi, 'Deoghar');
      const newTitle = ev.title.replace(/Ranchi/gi, 'Deoghar');
      await prisma.event.update({
        where: { id: ev.id },
        data: {
          venue: newVenue.includes('Deoghar') ? newVenue : 'Deoghar, Jharkhand',
          title: newTitle,
        },
      });
      console.log(`[${label}] Updated event ${ev.id}: title="${newTitle}", venue="Deoghar, Jharkhand"`);
    }
  } catch (err) {
    console.error(`[${label}] Error updating:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await updateDb(localUrl, 'LOCAL');
  await updateDb(neonUrl, 'NEON_CLOUD');
}

main();
