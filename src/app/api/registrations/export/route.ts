import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateCsv } from '@/lib/csv';

import { getSession } from '@/lib/auth';
import { getEventContext } from '@/lib/event-context';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required. Please sign in.' }, { status: 401 });
    }
    if (session.role !== 'ADMIN' && session.role !== 'OPERATOR') {
      return NextResponse.json(
        { error: 'Forbidden. Admin or Desk Operator privileges required.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventIdParam = searchParams.get('eventId');

    let eventId = eventIdParam;
    if (!eventId) {
      const eventCtx = await getEventContext();
      if (eventCtx) {
        eventId = eventCtx.eventId;
      } else {
        const activeEvent = await prisma.event.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        });
        if (!activeEvent) {
          return NextResponse.json({ error: 'No active event found' }, { status: 404 });
        }
        eventId = activeEvent.id;
      }
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
      'Accompanying Count',
      'Accompanying Names',
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
      const accList = (r.accompanyingPersons as any[]) || [];
      const accCount = accList.length;
      const accNames = accList.map((a: any) => `${a.name}${a.relation ? ` (${a.relation})` : ''}`).join('; ');

      return [
        r.ticketCode,
        r.person.firstName,
        r.person.lastName,
        r.person.email,
        r.person.phone || '',
        r.person.company || '',
        r.person.jobTitle || '',
        r.status,
        accCount,
        accNames,
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
