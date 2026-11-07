import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface SessionData {
  userId: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'VENDOR' | 'VOLUNTEER';
  expiresAt: number;
}

function parseSession(cookieValue: string | undefined): SessionData | null {
  if (!cookieValue) return null;
  try {
    const [b64Data] = cookieValue.split('.');
    if (!b64Data) return null;
    // Decode base64url string
    const binary = atob(b64Data.replace(/-/g, '+').replace(/_/g, '/'));
    const payload: SessionData = JSON.parse(binary);
    if (!payload.expiresAt || Date.now() > payload.expiresAt) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('ec_session')?.value;
  const session = parseSession(sessionCookie);

  const isLoginPage = pathname === '/login';
  const isBadgePage = pathname.startsWith('/badge/');

  // 1. If NO ONE is logged in:
  if (!session) {
    if (isLoginPage || isBadgePage) {
      // Allow access to login page and public attendee digital badges
      return NextResponse.next();
    }
    // Redirect all other pages to /login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 2. If user IS logged in and tries to access /login:
  if (isLoginPage) {
    if (session.role === 'VENDOR') {
      return NextResponse.redirect(new URL('/scanner', request.url));
    }
    if (session.role === 'OPERATOR') {
      return NextResponse.redirect(new URL('/participants', request.url));
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 3. Role-based view protection:
  // VENDOR: can ONLY see /scanner
  if (session.role === 'VENDOR') {
    if (pathname !== '/scanner' && !pathname.startsWith('/api/')) {
      return NextResponse.redirect(new URL('/scanner', request.url));
    }
  }

  // OPERATOR (Registration Desk Staff):
  // Has access to /participants, /register, and /scanner.
  // Must NOT have access to Super Admin governance pages: /audit, /backend, or /users.
  if (session.role === 'OPERATOR') {
    if (
      pathname === '/' ||
      pathname === '/audit' ||
      pathname === '/backend' ||
      pathname === '/users' ||
      pathname.startsWith('/users/')
    ) {
      return NextResponse.redirect(new URL('/participants', request.url));
    }
  }

  // ADMIN-only routes: /users, /backend, /audit
  if (pathname === '/users' || pathname.startsWith('/users/')) {
    if (session.role !== 'ADMIN') {
      return NextResponse.redirect(new URL(session.role === 'VENDOR' ? '/scanner' : '/participants', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - static assets: favicon.ico, icon.svg, evently-logo.jpg, uploads/
     * - api/ (let API routes return appropriate JSON errors)
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|evently-logo.jpg|jasicon-logo.svg|branding/|uploads/|api/).*)',
  ],
};
