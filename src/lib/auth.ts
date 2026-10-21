import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const SESSION_COOKIE_NAME = 'ec_session';

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === 'fallback-secret-development-only-replace') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY ERROR: SESSION_SECRET must be explicitly configured in production.');
    }
    return 'fallback-secret-development-only-replace';
  }
  return secret;
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'VOLUNTEER';
  expiresAt: number;
}

/**
 * Hash password with secure scrypt and salt.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify plaintext password against stored salt:hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, keyHex] = storedHash.split(':');
    if (!salt || !keyHex) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuf = Buffer.from(keyHex, 'hex');
    return crypto.timingSafeEqual(derivedKey, keyBuf);
  } catch {
    return false;
  }
}

/**
 * Sign session token payload using HMAC-SHA256.
 */
export function signSession(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  return `${data}.${hmac}`;
}

/**
 * Verify and parse session token.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Retrieve active session from incoming cookies.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Store session token in HTTP-only secure cookie.
 */
export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const cookieStore = await cookies();
  const token = signSession(payload);
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/**
 * Clear session cookie on logout.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Authenticate credentials and return user model.
 * Default development accounts (*@eventcheck.local) are strictly blocked in production.
 */
export async function authenticateUser(email: string, passwordPlain: string) {
  const normalizedEmail = email.toLowerCase().trim();

  // Defense-in-depth: Never permit mock/seed development accounts in production
  if (process.env.NODE_ENV === 'production' && normalizedEmail.endsWith('@eventcheck.local')) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.isActive) return null;
  if (!verifyPassword(passwordPlain, user.passwordHash)) return null;

  return user;
}

/**
 * Require active Administrator session. Returns session or null.
 */
export async function requireAdmin(): Promise<{ authorized: true; session: SessionPayload } | { authorized: false; status: 401 | 403; error: string }> {
  const session = await getSession();
  if (!session) {
    return { authorized: false, status: 401, error: 'Authentication required. Please sign in.' };
  }
  if (session.role !== 'ADMIN') {
    return { authorized: false, status: 403, error: 'Forbidden. Administrator privileges required.' };
  }
  return { authorized: true, session };
}

/**
 * Require authenticated staff session (Admin or Operator). Returns session or null.
 */
export async function requireStaff(): Promise<{ authorized: true; session: SessionPayload } | { authorized: false; status: 401; error: string }> {
  const session = await getSession();
  if (!session) {
    return { authorized: false, status: 401, error: 'Authentication required. Please sign in.' };
  }
  return { authorized: true, session };
}
