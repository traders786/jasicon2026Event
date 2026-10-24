import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { ACTIVE_EVENT_COOKIE } from '@/lib/event-context';

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Only Super Administrators can switch active events.' }, { status: 403 });
    }

    const body = await request.json();
    const { eventId } = body;

    if (!eventId || typeof eventId !== 'string') {
      return NextResponse.json({ error: 'Valid eventId is required' }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_EVENT_COOKIE, event.id, {
      httpOnly: false, // Accessible to JS so theme/switcher can reflect immediately
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return NextResponse.json({
      success: true,
      activeEvent: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        primaryColor: event.primaryColor,
        accentColor: event.accentColor,
        venue: event.venue,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to switch event';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
