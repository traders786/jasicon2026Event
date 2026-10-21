import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}

export async function GET(request: Request) {
  await clearSessionCookie();
  return NextResponse.redirect(new URL('/login', request.url));
}
