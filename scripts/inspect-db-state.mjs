import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const regCount = await prisma.eventRegistration.count();
  const personCount = await prisma.person.count();
  console.log(`Total event registrations: ${regCount}`);
  console.log(`Total people: ${personCount}`);

  // Fetch the latest 10 registrations
  const latestRegs = await prisma.eventRegistration.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { person: true },
  });

  console.log('\n--- Latest 10 registrations ---');
  for (const r of latestRegs) {
    console.log({
      ticketCode: r.ticketCode,
      personName: `${r.person.firstName} ${r.person.lastName}`,
      email: r.person.email,
      phone: r.person.phone,
      company: r.person.company,
      jobTitle: r.person.jobTitle,
      createdAt: r.createdAt,
    });
  }

  // Fetch the earliest of the imported batch (around EC-2026-0016)
  const batchStart = await prisma.eventRegistration.findMany({
    where: { ticketCode: { in: ['EC-2026-0015', 'EC-2026-0016', 'EC-2026-0017', 'EC-2026-0018', 'EC-2026-0019', 'EC-2026-0020'] } },
    orderBy: { ticketCode: 'asc' },
    include: { person: true },
  });

  console.log('\n--- Batch Start Around EC-2026-0016 ---');
  for (const r of batchStart) {
    console.log({
      ticketCode: r.ticketCode,
      personName: `${r.person.firstName} ${r.person.lastName}`,
      email: r.person.email,
      phone: r.person.phone,
      company: r.person.company,
      jobTitle: r.person.jobTitle,
    });
  }

  // Count how many are "Guest Participant"
  const guestCount = await prisma.person.count({
    where: { firstName: 'Guest', lastName: 'Participant' },
  });
  console.log(`\nTotal 'Guest Participant' records: ${guestCount}`);

  const redeemed = await prisma.entitlement.count({
    where: {
      status: 'REDEEMED',
      registration: { ticketCode: { gte: 'EC-2026-0016', lte: 'EC-2026-0142' } },
    },
  });
  console.log(`Redeemed entitlements among EC-2026-0016 to EC-2026-0142: ${redeemed}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
