import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { getEventContext } from '@/lib/event-context';

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const eventIdParam = searchParams.get('eventId');
    const categoryParam = searchParams.get('category'); // ALL, MEAL, SESSION
    const resultParam = searchParams.get('result'); // ALL, SUCCESS, ALREADY_REDEEMED, etc.
    const searchParam = searchParams.get('search')?.trim().toLowerCase() || '';

    // Fetch all events for the selector
    const allEvents = await prisma.event.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        venue: true,
        city: true,
        startDate: true,
        endDate: true,
        isActive: true,
      },
    });

    let targetEventId = eventIdParam;
    if (!targetEventId) {
      const eventCtx = await getEventContext();
      if (eventCtx?.eventId) {
        targetEventId = eventCtx.eventId;
      } else {
        const defaultEvt = allEvents.find((e) => e.isActive) || allEvents[0];
        targetEventId = defaultEvt ? defaultEvt.id : null;
      }
    }

    if (!targetEventId) {
      return NextResponse.json({
        events: allEvents,
        currentEvent: null,
        summary: {
          totalScans: 0,
          successfulScans: 0,
          duplicateScans: 0,
          failedScans: 0,
          totalMealsClaimed: 0,
          totalMealsEligible: 0,
          uniqueAttendeesServed: 0,
          mealBreakdown: [],
          sessionBreakdown: [],
          stationBreakdown: [],
        },
        logs: [],
      });
    }

    const currentEvent = allEvents.find((e) => e.id === targetEventId) || null;

    // 1. Fetch total scan count & summary metrics
    const baseWhere = {
      registration: {
        eventId: targetEventId,
      },
    };

    const [
      totalScans,
      successfulScans,
      duplicateScans,
      totalMealsClaimed,
      totalMealsEligible,
    ] = await Promise.all([
      prisma.redemptionLog.count({ where: baseWhere }),
      prisma.redemptionLog.count({ where: { ...baseWhere, result: 'SUCCESS' } }),
      prisma.redemptionLog.count({ where: { ...baseWhere, result: 'ALREADY_REDEEMED' } }),
      prisma.entitlement.count({
        where: {
          category: 'MEAL',
          status: 'REDEEMED',
          registration: { eventId: targetEventId },
        },
      }),
      prisma.entitlement.count({
        where: {
          category: 'MEAL',
          registration: { eventId: targetEventId },
        },
      }),
    ]);

    const failedScans = totalScans - (successfulScans + duplicateScans);

    // 2. Fetch Meal Entitlement Breakdown
    const mealEntitlements = await prisma.entitlement.findMany({
      where: {
        category: 'MEAL',
        registration: { eventId: targetEventId },
      },
      select: {
        code: true,
        title: true,
        status: true,
      },
    });

    const mealGroupMap: Record<string, { code: string; title: string; claimed: number; total: number }> = {};
    for (const ent of mealEntitlements) {
      const key = ent.code;
      if (!mealGroupMap[key]) {
        mealGroupMap[key] = {
          code: ent.code,
          title: ent.title,
          claimed: 0,
          total: 0,
        };
      }
      mealGroupMap[key].total += 1;
      if (ent.status === 'REDEEMED') {
        mealGroupMap[key].claimed += 1;
      }
    }

    const mealBreakdown = Object.values(mealGroupMap).map((m) => ({
      code: m.code,
      title: m.title,
      claimedCount: m.claimed,
      totalCount: m.total,
      claimRate: m.total > 0 ? Math.round((m.claimed / m.total) * 100) : 0,
    }));

    // Sort meals logically by title/code
    mealBreakdown.sort((a, b) => a.title.localeCompare(b.title));

    // 3. Fetch Session Entitlement Breakdown
    const sessionEntitlements = await prisma.entitlement.findMany({
      where: {
        category: 'SESSION',
        registration: { eventId: targetEventId },
      },
      select: {
        code: true,
        title: true,
        status: true,
      },
    });

    const sessionGroupMap: Record<string, { code: string; title: string; claimed: number; total: number }> = {};
    for (const ent of sessionEntitlements) {
      const key = ent.code;
      if (!sessionGroupMap[key]) {
        sessionGroupMap[key] = {
          code: ent.code,
          title: ent.title,
          claimed: 0,
          total: 0,
        };
      }
      sessionGroupMap[key].total += 1;
      if (ent.status === 'REDEEMED') {
        sessionGroupMap[key].claimed += 1;
      }
    }

    const sessionBreakdown = Object.values(sessionGroupMap).map((s) => ({
      code: s.code,
      title: s.title,
      claimedCount: s.claimed,
      totalCount: s.total,
      claimRate: s.total > 0 ? Math.round((s.claimed / s.total) * 100) : 0,
    }));

    // 4. Fetch Scan Logs for this event
    const logWhere: any = {
      registration: {
        eventId: targetEventId,
      },
    };

    if (resultParam && resultParam !== 'ALL') {
      logWhere.result = resultParam;
    }

    if (categoryParam && categoryParam !== 'ALL') {
      logWhere.entitlement = {
        category: categoryParam,
      };
    }

    const rawLogs = await prisma.redemptionLog.findMany({
      where: logWhere,
      orderBy: { scannedAt: 'desc' },
      take: 2000,
      include: {
        registration: {
          include: {
            person: true,
          },
        },
        entitlement: true,
        operator: {
          select: { name: true, role: true, email: true },
        },
      },
    });

    // Count unique attendees served
    const uniqueAttendees = new Set<string>();
    rawLogs.forEach((log) => {
      if (log.result === 'SUCCESS' && log.registration?.personId) {
        uniqueAttendees.add(log.registration.personId);
      }
    });

    // Calculate station breakdown
    const stationCountMap: Record<string, number> = {};
    rawLogs.forEach((log) => {
      const station = log.deviceInfo || 'Default Scanner';
      stationCountMap[station] = (stationCountMap[station] || 0) + 1;
    });

    const stationBreakdown = Object.entries(stationCountMap).map(([station, count]) => ({
      station,
      count,
    }));

    // Filter by search string if provided
    let formattedLogs = rawLogs.map((log) => {
      const person = log.registration?.person;
      const participantName = person ? `${person.firstName} ${person.lastName}`.trim() : 'Guest Attendee';
      return {
        id: log.id,
        scannedAt: log.scannedAt.toISOString(),
        result: log.result,
        participantName,
        doctorName: participantName,
        ticketCode: log.registration?.ticketCode || 'N/A',
        email: person?.email || '',
        phone: person?.phone || '',
        company: person?.company || '',
        jobTitle: person?.jobTitle || 'Delegate',
        category: log.entitlement?.category || 'GENERAL',
        entitlementCode: log.entitlement?.code || 'N/A',
        entitlementTitle: log.entitlement?.title || 'Scan Event',
        deviceInfo: log.deviceInfo || 'Scanner Counter',
        operatorName: log.operator?.name || 'Authorized Staff',
        notes: log.notes || '',
      };
    });

    if (searchParam) {
      formattedLogs = formattedLogs.filter((l) =>
        l.participantName.toLowerCase().includes(searchParam) ||
        l.ticketCode.toLowerCase().includes(searchParam) ||
        l.phone.toLowerCase().includes(searchParam) ||
        l.entitlementTitle.toLowerCase().includes(searchParam) ||
        l.deviceInfo.toLowerCase().includes(searchParam)
      );
    }

    return NextResponse.json({
      events: allEvents,
      currentEvent,
      summary: {
        totalScans,
        successfulScans,
        duplicateScans,
        failedScans,
        totalMealsClaimed,
        totalMealsEligible,
        uniqueAttendeesServed: uniqueAttendees.size,
        mealBreakdown,
        sessionBreakdown,
        stationBreakdown,
      },
      logs: formattedLogs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch audit data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
