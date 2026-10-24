import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEventContext } from '@/lib/event-context';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  const eventCtx = await getEventContext();

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      assignedEventId: eventCtx?.eventId || null,
      assignedStationCode: eventCtx?.assignedStationCode || null,
    },
    event: eventCtx?.event || null,
    isSuperAdmin: session.role === 'ADMIN',
  });
}
