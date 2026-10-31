import { NextResponse } from 'next/server';
import { lookupByQrToken } from '@/lib/redemption';
import { getSession } from '@/lib/auth';
import { getEventContext } from '@/lib/event-context';
import { z } from 'zod';

const LookupSchema = z.object({
  qrToken: z.string().min(1, 'QR token is required'),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const eventCtx = await getEventContext();
    if (!eventCtx) {
      return NextResponse.json({ error: 'No active or assigned event context found.' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = LookupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid QR token is required' }, { status: 400 });
    }

    const data = await lookupByQrToken(parsed.data.qrToken, eventCtx.eventId);
    if (!data) {
      return NextResponse.json(
        { error: 'No matching active registration found for this QR code in this conference.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      registrationId: data.registration.id,
      ticketCode: data.registration.ticketCode,
      status: data.registration.status,
      checkedInAt: data.registration.checkedInAt,
      accompanyingPersons: (data.registration.accompanyingPersons as any[]) || [],
      person: {
        id: data.person.id,
        name: `${data.person.firstName} ${data.person.lastName}`,
        email: data.person.email,
        phone: data.person.phone,
        company: data.person.company,
        jobTitle: data.person.jobTitle,
      },
      event: {
        id: data.event.id,
        title: data.event.title,
        venue: data.event.venue,
      },
      meals: data.meals.map((m) => ({
        id: m.id,
        code: m.code,
        title: m.title,
        status: m.status,
        redeemedAt: m.redeemedAt,
      })),
      sessions: data.sessions.map((s) => ({
        id: s.id,
        code: s.code,
        title: s.title,
        status: s.status,
        redeemedAt: s.redeemedAt,
      })),
      stats: data.stats,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Lookup failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
