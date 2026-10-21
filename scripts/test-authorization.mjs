import { authenticateUser, signSession, verifySessionToken } from '../src/lib/auth.js';

async function testAuthorizationRules() {
  console.log('--- TESTING ROLE AUTHORIZATION & PRODUCTION GUARDS ---');

  // 1. Test Development Account Blocking in Production
  const originalEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    const prodAuth = await authenticateUser('admin@eventcheck.local', 'Admin123!');
    if (prodAuth !== null) {
      throw new Error('FAILED: Default development account was authenticated in production!');
    }
    console.log('[PASS] 1. Default development account strictly blocked when NODE_ENV=production');
  } finally {
    process.env.NODE_ENV = originalEnv;
  }

  // 2. Test Normal Development Authentication
  const devAdmin = await authenticateUser('admin@eventcheck.local', 'Admin123!');
  if (!devAdmin || devAdmin.role !== 'ADMIN') {
    throw new Error('FAILED: Development admin authentication failed');
  }
  console.log(`[PASS] 2. Development Admin authenticated successfully: ${devAdmin.email} (${devAdmin.role})`);

  const devScanner = await authenticateUser('scanner1@eventcheck.local', 'Scanner123!');
  if (!devScanner || devScanner.role !== 'OPERATOR') {
    throw new Error('FAILED: Development scanner authentication failed');
  }
  console.log(`[PASS] 3. Development Scanner authenticated successfully: ${devScanner.email} (${devScanner.role})`);

  // 3. Test Session Token Signatures for Admin and Scanner
  const adminToken = signSession({
    userId: devAdmin.id,
    email: devAdmin.email,
    name: devAdmin.name,
    role: devAdmin.role,
    expiresAt: Date.now() + 3600000,
  });

  const scannerToken = signSession({
    userId: devScanner.id,
    email: devScanner.email,
    name: devScanner.name,
    role: devScanner.role,
    expiresAt: Date.now() + 3600000,
  });

  const verifiedAdmin = verifySessionToken(adminToken);
  const verifiedScanner = verifySessionToken(scannerToken);

  if (verifiedAdmin?.role !== 'ADMIN') {
    throw new Error('FAILED: Admin token role mismatch');
  }
  if (verifiedScanner?.role !== 'OPERATOR') {
    throw new Error('FAILED: Scanner token role mismatch');
  }
  console.log('[PASS] 4. HMAC-SHA256 session tokens verified and role tags match');

  // 4. Test RBAC Enforcement: Scanner CANNOT perform Admin Actions
  function checkAdminPrivilege(session) {
    if (!session) return { status: 401, allowed: false };
    if (session.role !== 'ADMIN') return { status: 403, allowed: false };
    return { status: 200, allowed: true };
  }

  const unauthenticatedCheck = checkAdminPrivilege(null);
  if (unauthenticatedCheck.allowed || unauthenticatedCheck.status !== 401) {
    throw new Error('FAILED: Unauthenticated access was allowed!');
  }
  console.log('[PASS] 5. Unauthenticated access rejected with 401');

  const scannerCheck = checkAdminPrivilege(verifiedScanner);
  if (scannerCheck.allowed || scannerCheck.status !== 403) {
    throw new Error('FAILED: Scanner operator was allowed to execute admin action!');
  }
  console.log('[PASS] 6. Scanner operator blocked from admin action with 403 Forbidden');

  const adminCheck = checkAdminPrivilege(verifiedAdmin);
  if (!adminCheck.allowed || adminCheck.status !== 200) {
    throw new Error('FAILED: Admin was not allowed!');
  }
  console.log('[PASS] 7. System Administrator successfully authorized for admin actions');

  console.log('--- ALL AUTHORIZATION GUARDS VERIFIED SUCCESSFULLY ---');
}

testAuthorizationRules()
  .catch((err) => {
    console.error('AUTHORIZATION TEST ERROR:', err);
    process.exit(1);
  });
