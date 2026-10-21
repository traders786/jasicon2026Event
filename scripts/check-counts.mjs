import { PrismaClient } from '@prisma/client';

const directNeonUrl = 'postgresql://neondb_owner:npg_q3mfvTNcuE0j@ep-autumn-union-b4utz1zp.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const p = new PrismaClient({
    datasources: { db: { url: directNeonUrl } },
  });
  try {
    const users = await p.user.count();
    const events = await p.event.count();
    const persons = await p.person.count();
    const regs = await p.eventRegistration.count();
    const ents = await p.entitlement.count();
    console.log({ users, events, persons, regs, ents });
  } finally {
    await p.$disconnect();
  }
}

main();
