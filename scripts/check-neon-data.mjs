import { PrismaClient } from '@prisma/client';

const directUrl = 'postgresql://neondb_owner:npg_q3mfvTNcuE0j@ep-autumn-union-b4utz1zp.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';

const prisma = new PrismaClient({
  datasources: {
    db: { url: directUrl }
  }
});

async function main() {
  const events = await prisma.event.findMany();
  console.log('Events in Neon:', JSON.stringify(events, null, 2));

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true }
  });
  console.log('Users in Neon:', JSON.stringify(users, null, 2));

  const regCount = await prisma.eventRegistration.count();
  console.log('Registration count in Neon:', regCount);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
