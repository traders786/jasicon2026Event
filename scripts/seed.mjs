import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const MEAL_DEFINITIONS = [
  { category: 'MEAL', code: 'MEAL_D1_BREAKFAST', title: 'Day 1: Breakfast Buffet' },
  { category: 'MEAL', code: 'MEAL_D1_LUNCH', title: 'Day 1: Executive Lunch' },
  { category: 'MEAL', code: 'MEAL_D1_DINNER', title: 'Day 1: Welcome Gala Dinner' },
  { category: 'MEAL', code: 'MEAL_D2_BREAKFAST', title: 'Day 2: Breakfast Buffet' },
  { category: 'MEAL', code: 'MEAL_D2_LUNCH', title: 'Day 2: Executive Lunch' },
  { category: 'MEAL', code: 'MEAL_D2_DINNER', title: 'Day 2: Networking Banquet' },
  { category: 'MEAL', code: 'MEAL_D3_BREAKFAST', title: 'Day 3: Breakfast Buffet' },
  { category: 'MEAL', code: 'MEAL_D3_LUNCH', title: 'Day 3: Farewell Lunch' },
  { category: 'MEAL', code: 'MEAL_D3_DINNER', title: 'Day 3: Closing Dinner' },
];

const SESSION_DEFINITIONS = [
  { category: 'SESSION', code: 'SES_01_KEYNOTE', title: 'Session 01: Opening Keynote & Future of AI' },
  { category: 'SESSION', code: 'SES_02_CLOUD_ARCH', title: 'Session 02: Resilient Cloud Architecture' },
  { category: 'SESSION', code: 'SES_03_SECURITY', title: 'Session 03: Zero-Trust Security Deep Dive' },
  { category: 'SESSION', code: 'SES_04_DATA_SYSTEMS', title: 'Session 04: High-Throughput Data Systems' },
  { category: 'SESSION', code: 'SES_05_AI_AGENTS', title: 'Session 05: Autonomous AI Agentic Systems' },
  { category: 'SESSION', code: 'SES_06_DEVOPS', title: 'Session 06: Modern Platform Engineering' },
  { category: 'SESSION', code: 'SES_07_WORKSHOP_A', title: 'Session 07: Hands-On Microservices Lab' },
  { category: 'SESSION', code: 'SES_08_WORKSHOP_B', title: 'Session 08: Distributed Consensus Workshop' },
  { category: 'SESSION', code: 'SES_09_SCALING', title: 'Session 09: Global Web Performance at Scale' },
  { category: 'SESSION', code: 'SES_10_CLOSING', title: 'Session 10: Closing Panel & Engineering Awards' },
];

const ALL_ENTITLEMENT_DEFINITIONS = [...MEAL_DEFINITIONS, ...SESSION_DEFINITIONS];

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

function generateToken() {
  const plainToken = `ec_tok_${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
  return { plainToken, tokenHash };
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[SECURITY ERROR] Database seeding with mock development data is strictly prohibited in production environments.');
    process.exit(1);
  }

  console.log('=== EventCheck Database Seeding (Development Only) ===\n');

  // 1. Create or ensure Default Event
  const event = await prisma.event.upsert({
    where: { slug: 'ai-summit-2026' },
    update: {},
    create: {
      title: 'Global AI & Cloud Engineering Summit 2026',
      slug: 'ai-summit-2026',
      description: 'The premier conference for distributed systems, agentic AI, and zero-trust engineering.',
      venue: 'Metropolitan Convention Centre, Hall A-D',
      startDate: new Date('2026-11-10T08:00:00Z'),
      endDate: new Date('2026-11-12T20:00:00Z'),
      isActive: true,
    },
  });
  console.log(`[Event] Ensured active event: ${event.title} (${event.id})`);

  // 2. Create Users (Admin and Scanner Operator)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@eventcheck.local' },
    update: {},
    create: {
      email: 'admin@eventcheck.local',
      name: 'System Administrator',
      passwordHash: hashPassword('Admin123!'),
      role: 'ADMIN',
      isActive: true,
    },
  });

  const scanner = await prisma.user.upsert({
    where: { email: 'scanner1@eventcheck.local' },
    update: {},
    create: {
      email: 'scanner1@eventcheck.local',
      name: 'Registration Desk Scanner',
      passwordHash: hashPassword('Scanner123!'),
      role: 'OPERATOR',
      isActive: true,
    },
  });
  console.log(`[Users] Created Admin (${admin.email}) and Scanner (${scanner.email})`);

  // 3. Create Sample Participants & Registrations
  const samplePeople = [
    {
      firstName: 'Sarah',
      lastName: 'Connor',
      email: 'sarah.connor@cyberdyne.io',
      phone: '+1-555-0199',
      company: 'Cyberdyne Systems AI',
      jobTitle: 'Principal Security Architect',
      status: 'CONFIRMED',
    },
    {
      firstName: 'Marcus',
      lastName: 'Vance',
      email: 'marcus.vance@nexus.dev',
      phone: '+1-555-0144',
      company: 'Nexus Cloud Infrastructure',
      jobTitle: 'VP of Platform Engineering',
      status: 'CHECKED_IN',
      preRedeem: ['MEAL_D1_BREAKFAST', 'MEAL_D1_LUNCH', 'SES_01_KEYNOTE'],
    },
    {
      firstName: 'Elena',
      lastName: 'Rostova',
      email: 'elena.rostova@quantumbio.org',
      phone: '+44-20-7946-0123',
      company: 'Quantum Bio Labs',
      jobTitle: 'Lead Bioinformatician',
      status: 'CHECKED_IN',
      preRedeem: ['MEAL_D1_BREAKFAST', 'MEAL_D1_LUNCH', 'MEAL_D1_DINNER', 'SES_01_KEYNOTE', 'SES_02_CLOUD_ARCH'],
    },
    {
      firstName: 'Devon',
      lastName: 'Reed',
      email: 'devon.reed@starlight.tech',
      phone: '+1-555-0872',
      company: 'Starlight Cloud Networks',
      jobTitle: 'Senior Site Reliability Engineer',
      status: 'CONFIRMED',
    },
  ];

  console.log('\n[Participants] Provisioning sample participants with 19 entitlements each...');
  const testTokens = [];

  for (let i = 0; i < samplePeople.length; i++) {
    const p = samplePeople[i];
    const ticketCode = `EC-2026-${String(i + 1).padStart(4, '0')}`;
    const { plainToken, tokenHash } = generateToken();

    // Create or get person
    const person = await prisma.person.upsert({
      where: { email: p.email },
      update: {
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        company: p.company,
        jobTitle: p.jobTitle,
      },
      create: {
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        company: p.company,
        jobTitle: p.jobTitle,
      },
    });

    // Create or get registration
    let registration = await prisma.eventRegistration.findUnique({
      where: {
        personId_eventId: {
          personId: person.id,
          eventId: event.id,
        },
      },
    });

    if (!registration) {
      registration = await prisma.eventRegistration.create({
        data: {
          personId: person.id,
          eventId: event.id,
          ticketCode,
          qrTokenHash: tokenHash,
          status: p.status,
          checkedInAt: p.status === 'CHECKED_IN' ? new Date() : null,
        },
      });

      // Provision all 19 entitlements
      const entitlementCreates = ALL_ENTITLEMENT_DEFINITIONS.map((def) => {
        const isPreRedeemed = p.preRedeem && p.preRedeem.includes(def.code);
        return {
          registrationId: registration.id,
          category: def.category,
          code: def.code,
          title: def.title,
          status: isPreRedeemed ? 'REDEEMED' : 'AVAILABLE',
          redeemedAt: isPreRedeemed ? new Date(Date.now() - 3600000) : null,
          version: isPreRedeemed ? 1 : 0,
        };
      });

      await prisma.entitlement.createMany({
        data: entitlementCreates,
      });

      // If pre-redeemed, record audit logs
      if (p.preRedeem && p.preRedeem.length > 0) {
        const preEntitlements = await prisma.entitlement.findMany({
          where: { registrationId: registration.id, code: { in: p.preRedeem } },
        });

        for (const pe of preEntitlements) {
          await prisma.redemptionLog.create({
            data: {
              registrationId: registration.id,
              entitlementId: pe.id,
              operatorId: scanner.id,
              result: 'SUCCESS',
              scannedAt: pe.redeemedAt || new Date(),
              deviceInfo: 'Desk Scanner Terminal #1 (Zebra DS2208)',
              notes: `Simulated pre-seeded redemption for ${pe.title}`,
            },
          });
        }
      }
    }

    testTokens.push({
      name: `${p.firstName} ${p.lastName}`,
      ticketCode,
      status: p.status,
      plainToken,
    });
  }

  console.log('\n=== Development Seeding Finished Successfully ===\n');
  console.log('[Users] Provisioned local development test accounts:');
  console.log(`  - Administrator: ${admin.email}`);
  console.log(`  - Scanner Desk:  ${scanner.email}`);
  console.log('  (Credentials are defined in local environment only; passwords are never logged.)\n');
}

main()
  .catch((e) => {
    console.error('[SEED ERROR]:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
