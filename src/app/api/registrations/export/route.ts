import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCsv } from '@/lib/csv';

import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const eventIdParam = searchParams.get('eventId');

    let eventId = eventIdParam;
    if (!eventId) {
      const activeEvent = await prisma.event.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!activeEvent) {
        return NextResponse.json({ error: 'No active event found' }, { status: 404 });
      }
      eventId = activeEvent.id;
    }

    const registrations = await prisma.eventRegistration.findMany({
      where: { eventId },
      include: {
        person: true,
        entitlements: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const headers = [
      'Ticket Code',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Company',
      'Job Title',
      'Status',
      'Checked In At',
      'Meals Redeemed',
      'Meals Total',
      'Sessions Redeemed',
      'Sessions Total',
      'Created At',
    ];

    const rows = registrations.map((r) => {
      const meals = r.entitlements.filter((e) => e.category === 'MEAL');
      const sessions = r.entitlements.filter((e) => e.category === 'SESSION');
      const mealsRedeemed = meals.filter((m) => m.status === 'REDEEMED').length;
      const sessionsRedeemed = sessions.filter((s) => s.status === 'REDEEMED').length;

      return [
        r.ticketCode,
        r.person.firstName,
        r.person.lastName,
        r.person.email,
        r.person.phone || '',
        r.person.company || '',
        r.person.jobTitle || '',
        r.status,
        r.checkedInAt ? r.checkedInAt.toISOString() : '',
        mealsRedeemed,
        meals.length,
        sessionsRedeemed,
        sessions.length,
        r.createdAt.toISOString(),
      ];
    });

    const csvData = generateCsv(headers, rows);

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="eventcheck-attendees-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
