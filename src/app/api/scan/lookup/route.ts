import { NextResponse } from 'next/server';
import { lookupByQrToken } from '@/lib/redemption';
import { z } from 'zod';

const LookupSchema = z.object({
  qrToken: z.string().min(1, 'QR token is required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = LookupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid QR token is required' }, { status: 400 });
    }

    const data = await lookupByQrToken(parsed.data.qrToken);
    if (!data) {
      return NextResponse.json(
        { error: 'No matching active registration found for this QR code.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      registrationId: data.registration.id,
      ticketCode: data.registration.ticketCode,
      status: data.registration.status,
      checkedInAt: data.registration.checkedInAt,
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
