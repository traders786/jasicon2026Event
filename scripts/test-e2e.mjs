import { prisma } from '../src/lib/prisma.js';
import { lookupByQrToken, redeemEntitlement } from '../src/lib/redemption.js';
import { generateSecureQrToken } from '../src/lib/qr.js';
import { ALL_ENTITLEMENT_DEFINITIONS } from '../src/lib/constants.js';

async function runEndToEndVerification() {
  console.log('--- STARTING EVENTCHECK E2E VERIFICATION ---');

  // 1. Verify Active Event
  const event = await prisma.event.findFirst({ where: { isActive: true } });
  if (!event) throw new Error('No active event found');
  console.log(`[PASS] 1. Active Event: "${event.title}" (${event.id})`);

  // 2. Lookup existing seed participant (Sarah Connor)
  const sarahReg = await prisma.eventRegistration.findFirst({
    where: { person: { email: 'sarah.connor@cyberdyne.io' } },
    include: { person: true, entitlements: true },
  });
  if (!sarahReg) throw new Error('Sarah Connor registration not found');

  // Find a free meal entitlement
  const availableMeal = sarahReg.entitlements.find(
    (e) => e.category === 'MEAL' && e.status === 'AVAILABLE'
  );
  if (!availableMeal) throw new Error('No available meal found for test');

  // Sample token from seed for Sarah
  const testToken = 'ec_tok_38a611a2997ae40cc0b0b47b60330c384f085175d5b5a3876e68e9ff2cb722f0';

  // 3. Lookup by QR token (Zero PII test)
  const lookupResult = await lookupByQrToken(testToken);
  if (!lookupResult || lookupResult.registration.id !== sarahReg.id) {
    throw new Error('QR lookup failed to match hash');
  }
  console.log(`[PASS] 2. Zero-PII QR Lookup succeeded: ${lookupResult.person.firstName} ${lookupResult.person.lastName} (${lookupResult.registration.ticketCode})`);

  // 4. Concurrency-safe atomic redemption
  const redeemResult1 = await redeemEntitlement({
    qrToken: testToken,
    entitlementCode: availableMeal.code,
    operatorId: undefined,
    deviceInfo: 'E2E Test Runner Desk #1',
    ipAddress: '127.0.0.1',
  });
  if (!redeemResult1.success || redeemResult1.result !== 'SUCCESS') {
    throw new Error(`First redemption failed: ${redeemResult1.message}`);
  }
  console.log(`[PASS] 3. First Redemption Succeeded: ${availableMeal.code}`);

  // 5. Duplicate Redemption Rejection Test
  const redeemResult2 = await redeemEntitlement({
    qrToken: testToken,
    entitlementCode: availableMeal.code,
    operatorId: undefined,
    deviceInfo: 'E2E Test Runner Desk #2 (Concurrent Attempt)',
    ipAddress: '127.0.0.1',
  });
  if (redeemResult2.success || redeemResult2.result !== 'ALREADY_REDEEMED') {
    throw new Error(`Duplicate redemption was NOT rejected! Result: ${redeemResult2.result}`);
  }
  console.log(`[PASS] 4. Duplicate Redemption Safely Blocked: ${redeemResult2.result}`);

  // 6. Audit Trail Verification
  const auditLogs = await prisma.redemptionLog.findMany({
    where: { registrationId: sarahReg.id, entitlementId: availableMeal.id },
    orderBy: { scannedAt: 'desc' },
    take: 2,
  });
  if (auditLogs.length < 2) throw new Error('Expected 2 audit records');
  console.log(`[PASS] 5. Audit Trail Confirmed: Log 1=${auditLogs[0].result}, Log 2=${auditLogs[1].result}`);

  // 7. Verify Unique Registration Constraint per Person per Event
  const testPersonEmail = `test.attendee.${Date.now()}@example.com`;
  const newPerson = await prisma.person.create({
    data: {
      firstName: 'Test',
      lastName: 'Participant',
      email: testPersonEmail,
    },
  });

  const { tokenHash: hash1 } = generateSecureQrToken();
  const reg1 = await prisma.eventRegistration.create({
    data: {
      personId: newPerson.id,
      eventId: event.id,
      ticketCode: `EC-TEST-${Date.now()}`,
      qrTokenHash: hash1,
      entitlements: {
        create: ALL_ENTITLEMENT_DEFINITIONS.map((ent) => ({
          code: ent.code,
          title: ent.title,
          category: ent.category,
          status: 'AVAILABLE',
        })),
      },
    },
    include: { entitlements: true },
  });

  if (reg1.entitlements.length !== 19) {
    throw new Error(`Expected 19 entitlements, got ${reg1.entitlements.length}`);
  }
  const mealCount = reg1.entitlements.filter((e) => e.category === 'MEAL').length;
  const sessionCount = reg1.entitlements.filter((e) => e.category === 'SESSION').length;
  console.log(`[PASS] 6. New Registration provisioned exactly 19 entitlements (9 meals: ${mealCount}, 10 sessions: ${sessionCount})`);

  // Attempt duplicate registration for same person and event -> MUST FAIL
  let duplicateCaught = false;
  try {
    const { tokenHash: hash2 } = generateSecureQrToken();
    await prisma.eventRegistration.create({
      data: {
        personId: newPerson.id,
        eventId: event.id,
        ticketCode: `EC-TEST-DUP-${Date.now()}`,
        qrTokenHash: hash2,
      },
    });
  } catch {
    duplicateCaught = true;
  }

  if (!duplicateCaught) {
    throw new Error('Database allowed duplicate registration for same person in same event!');
  }
  console.log('[PASS] 7. Database unique constraint strictly enforced (one registration per person per event)');

  console.log('--- ALL EVENTCHECK E2E VERIFICATION CHECKS PASSED ---');
}

runEndToEndVerification()
  .catch((e) => {
    console.error('E2E FAILURE:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
