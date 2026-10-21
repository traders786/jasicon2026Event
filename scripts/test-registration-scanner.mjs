import { prisma } from '../src/lib/prisma.js';
import { lookupByQrToken, redeemEntitlement } from '../src/lib/redemption.js';
import { generateSecureQrToken, renderQrCodeDataUrl } from '../src/lib/qr.js';
import { ALL_ENTITLEMENT_DEFINITIONS } from '../src/lib/constants.js';

async function runRegressionTests() {
  console.log('==============================================================');
  console.log('EVENTCHECK REGISTRATION-TO-SCANNER REGRESSION TEST SUITE');
  console.log('==============================================================');

  // -------------------------------------------------------------
  // Test 1: Verify Existing Target Registration EC-2026-0008
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Existing Registration EC-2026-0008 Lookup ---');
  const reg0008 = await prisma.eventRegistration.findUnique({
    where: { ticketCode: 'EC-2026-0008' },
    include: { person: true, entitlements: true },
  });

  if (!reg0008) {
    throw new Error('Target registration EC-2026-0008 does not exist in database!');
  }

  // 1a. Standard Ticket Code lookup
  const resTicketExact = await lookupByQrToken('EC-2026-0008');
  if (!resTicketExact || resTicketExact.registration.ticketCode !== 'EC-2026-0008') {
    throw new Error('FAIL: Lookup by ticket code "EC-2026-0008" failed');
  }
  console.log('[PASS] 1a. Lookup by exact ticket code "EC-2026-0008" resolved successfully');

  // 1b. Case-insensitive Ticket Code lookup
  const resTicketLower = await lookupByQrToken('ec-2026-0008');
  if (!resTicketLower || resTicketLower.registration.ticketCode !== 'EC-2026-0008') {
    throw new Error('FAIL: Lookup by lowercase ticket code "ec-2026-0008" failed');
  }
  console.log('[PASS] 1b. Lookup by lowercase ticket code "ec-2026-0008" resolved successfully');

  // 1c. Scanner input with whitespace & newline suffixes (common from optical scanners)
  const resTicketWhitespace = await lookupByQrToken('  EC-2026-0008 \r\n');
  if (!resTicketWhitespace || resTicketWhitespace.registration.ticketCode !== 'EC-2026-0008') {
    throw new Error('FAIL: Lookup with whitespace/newline failed');
  }
  console.log('[PASS] 1c. Lookup with scanner whitespace and newline suffixes resolved successfully');

  // 1d. Formatted badge payload lookup
  const resTicketFormatted = await lookupByQrToken(`EC_TICKET:EC-2026-0008:${reg0008.id}`);
  if (!resTicketFormatted || resTicketFormatted.registration.ticketCode !== 'EC-2026-0008') {
    throw new Error('FAIL: Lookup by formatted badge string failed');
  }
  console.log('[PASS] 1d. Lookup by formatted badge string resolved successfully');

  // -------------------------------------------------------------
  // Test 2: Flow for a Newly Created Registration
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Complete Flow for Newly Created Registration ---');
  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) throw new Error('No active event found');

  const testEmail = `regression.attendee.${Date.now()}@example.com`;
  const person = await prisma.person.create({
    data: {
      firstName: 'Regression',
      lastName: 'Tester',
      email: testEmail,
      company: 'EventCheck QA Systems',
      jobTitle: 'Verification Specialist',
    },
  });

  const latestReg = await prisma.eventRegistration.findFirst({
    where: { ticketCode: { startsWith: 'EC-2026-' } },
    orderBy: { ticketCode: 'desc' },
    select: { ticketCode: true },
  });
  let nextNum = 1;
  if (latestReg?.ticketCode) {
    const match = latestReg.ticketCode.match(/EC-2026-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }
  const newTicketCode = `EC-2026-${String(nextNum).padStart(4, '0')}`;

  // Generate secure token (Zero-PII)
  const { plainToken, tokenHash } = generateSecureQrToken();

  // Verify SHA-256 hash length and properties
  if (!tokenHash || tokenHash.length !== 64 || !/^[0-9a-f]{64}$/.test(tokenHash)) {
    throw new Error('FAIL: tokenHash is not a valid 64-character SHA-256 digest');
  }

  // Create registration and 19 entitlements
  const newReg = await prisma.eventRegistration.create({
    data: {
      personId: person.id,
      eventId: activeEvent.id,
      ticketCode: newTicketCode,
      qrTokenHash: tokenHash,
      status: 'CONFIRMED',
      entitlements: {
        create: ALL_ENTITLEMENT_DEFINITIONS.map((def) => ({
          code: def.code,
          title: def.title,
          category: def.category,
          status: 'AVAILABLE',
          version: 0,
        })),
      },
    },
    include: { entitlements: true },
  });

  // Generate QR Data URL (simulates registration API output)
  const qrDataUrl = await renderQrCodeDataUrl(plainToken);
  if (!qrDataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('FAIL: QR Data URL was not properly generated');
  }

  // Verify database record does NOT contain plainToken anywhere
  const dbRecord = await prisma.eventRegistration.findUnique({
    where: { id: newReg.id },
  });
  if (JSON.stringify(dbRecord).includes(plainToken)) {
    throw new Error('CRITICAL SECURITY VIOLATION: Plaintext bearer token found stored in database!');
  }
  console.log(`[PASS] 2a. Registration created with ticketCode "${newTicketCode}" and SHA-256 token hash`);
  console.log('[PASS] 2b. Database storage verified: Plaintext bearer token is NEVER stored');
  console.log('[PASS] 2c. QR Code Image Data URL generated successfully');

  // -------------------------------------------------------------
  // Test 3: Resolution of Newly Created Registration
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Scanner Resolution of Newly Created Registration ---');

  // 3a. Lookup by bearer token (from QR scan)
  const lookupByToken = await lookupByQrToken(plainToken);
  if (!lookupByToken || lookupByToken.registration.id !== newReg.id) {
    throw new Error('FAIL: Lookup by raw bearer token failed');
  }
  if (lookupByToken.entitlements.length !== 19) {
    throw new Error(`FAIL: Expected 19 entitlements, got ${lookupByToken.entitlements.length}`);
  }
  console.log('[PASS] 3a. Scanner QR bearer-token lookup succeeded (all 19 entitlements verified)');

  // 3b. Lookup by bearer token with scanner linefeed/carriage return suffix
  const lookupByTokenWithCRLF = await lookupByQrToken(`${plainToken}\r\n`);
  if (!lookupByTokenWithCRLF || lookupByTokenWithCRLF.registration.id !== newReg.id) {
    throw new Error('FAIL: Lookup by bearer token with trailing CRLF failed');
  }
  console.log('[PASS] 3b. Scanner QR bearer-token lookup with trailing CRLF succeeded');

  // 3c. Lookup by human-readable ticket code
  const lookupByCode = await lookupByQrToken(newTicketCode);
  if (!lookupByCode || lookupByCode.registration.id !== newReg.id) {
    throw new Error('FAIL: Lookup by ticket code failed');
  }
  console.log(`[PASS] 3c. Lookup by ticket code "${newTicketCode}" succeeded`);

  // 3d. Lookup by lowercase ticket code
  const lookupByCodeLower = await lookupByQrToken(newTicketCode.toLowerCase());
  if (!lookupByCodeLower || lookupByCodeLower.registration.id !== newReg.id) {
    throw new Error('FAIL: Lookup by lowercase ticket code failed');
  }
  console.log('[PASS] 3d. Lookup by lowercase ticket code succeeded');

  // -------------------------------------------------------------
  // Test 4: Atomic Entitlement Redemption & Duplicate Protection
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Entitlement Redemption and Duplicate Prevention ---');

  const mealEntitlement = newReg.entitlements.find(
    (e) => e.category === 'MEAL' && e.status === 'AVAILABLE'
  );
  if (!mealEntitlement) throw new Error('No available meal entitlement found');

  // 4a. Initial redemption using ticket code
  const redeemResult1 = await redeemEntitlement({
    qrToken: newTicketCode, // Using ticket code
    entitlementCode: mealEntitlement.code,
    operatorId: undefined,
    deviceInfo: 'Regression Test Station A',
    ipAddress: '127.0.0.1',
  });

  if (!redeemResult1.success || redeemResult1.result !== 'SUCCESS') {
    throw new Error(`FAIL: Initial redemption failed: ${redeemResult1.message}`);
  }
  console.log(`[PASS] 4a. Initial redemption of ${mealEntitlement.code} via ticket code succeeded`);

  // Verify participant check-in status was updated
  const updatedReg = await prisma.eventRegistration.findUnique({
    where: { id: newReg.id },
  });
  if (updatedReg?.status !== 'CHECKED_IN' || !updatedReg.checkedInAt) {
    throw new Error('FAIL: Registration status was not updated to CHECKED_IN upon redemption');
  }
  console.log('[PASS] 4b. Registration status updated to CHECKED_IN with timestamp');

  // 4c. Duplicate redemption attempt using bearer token
  const duplicateRedeem = await redeemEntitlement({
    qrToken: plainToken, // Using bearer token for the duplicate attempt
    entitlementCode: mealEntitlement.code,
    operatorId: undefined,
    deviceInfo: 'Regression Test Station B (Duplicate Attempt)',
    ipAddress: '127.0.0.1',
  });

  if (duplicateRedeem.success || duplicateRedeem.result !== 'ALREADY_REDEEMED') {
    throw new Error(`FAIL: Duplicate redemption was NOT blocked! Result: ${duplicateRedeem.result}`);
  }
  console.log('[PASS] 4c. Duplicate redemption blocked: Result = ALREADY_REDEEMED');

  // 4d. Audit log check
  const auditLogs = await prisma.redemptionLog.findMany({
    where: { registrationId: newReg.id, entitlementId: mealEntitlement.id },
    orderBy: { scannedAt: 'asc' },
  });
  if (auditLogs.length !== 2) {
    throw new Error(`FAIL: Expected 2 audit logs (1 SUCCESS, 1 ALREADY_REDEEMED), got ${auditLogs.length}`);
  }
  if (auditLogs[0].result !== 'SUCCESS' || auditLogs[1].result !== 'ALREADY_REDEEMED') {
    throw new Error('FAIL: Audit log results do not match expected sequence');
  }
  console.log('[PASS] 4d. Audit trail recorded: First=SUCCESS, Second=ALREADY_REDEEMED');

  // 4e. Second entitlement redemption using bearer token
  const sessionEntitlement = newReg.entitlements.find(
    (e) => e.category === 'SESSION' && e.status === 'AVAILABLE'
  );
  if (!sessionEntitlement) throw new Error('No available session entitlement found');

  const sessionRedeem1 = await redeemEntitlement({
    qrToken: plainToken,
    entitlementCode: sessionEntitlement.code,
    deviceInfo: 'Regression Test Station A',
    ipAddress: '127.0.0.1',
  });
  if (!sessionRedeem1.success || sessionRedeem1.result !== 'SUCCESS') {
    throw new Error(`FAIL: Session redemption failed: ${sessionRedeem1.message}`);
  }
  console.log(`[PASS] 4e. Session redemption of ${sessionEntitlement.code} via bearer token succeeded`);

  // Duplicate session redemption using ticket code
  const sessionDuplicate = await redeemEntitlement({
    qrToken: newTicketCode,
    entitlementCode: sessionEntitlement.code,
    deviceInfo: 'Regression Test Station B',
    ipAddress: '127.0.0.1',
  });
  if (sessionDuplicate.success || sessionDuplicate.result !== 'ALREADY_REDEEMED') {
    throw new Error(`FAIL: Duplicate session redemption was not blocked!`);
  }
  console.log('[PASS] 4f. Cross-identifier duplicate session redemption blocked (ticketCode vs plainToken)');

  // -------------------------------------------------------------
  // Test 5: Invalid Token Handling
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Invalid Identifier Handling ---');
  const invalidLookup = await lookupByQrToken('EC-DOES-NOT-EXIST-9999');
  if (invalidLookup !== null) {
    throw new Error('FAIL: Non-existent identifier returned a registration');
  }
  console.log('[PASS] 5a. Non-existent ticket code safely returns null');

  const invalidRedeem = await redeemEntitlement({
    qrToken: 'ec_tok_0000000000000000000000000000000000000000000000000000000000000000',
    entitlementCode: 'MEAL_D1_LUNCH',
  });
  if (invalidRedeem.success || invalidRedeem.result !== 'INVALID_QR') {
    throw new Error('FAIL: Invalid token redemption did not return INVALID_QR');
  }
  console.log('[PASS] 5b. Invalid bearer token redemption safely rejected with INVALID_QR');

  console.log('\n==============================================================');
  console.log('ALL REGRESSION TESTS PASSED SUCCESSFULLY');
  console.log('==============================================================');
}

runRegressionTests()
  .catch((e) => {
    console.error('\nREGRESSION TEST FAILED:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
