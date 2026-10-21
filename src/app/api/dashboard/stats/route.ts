import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    // Build event filter
    const eventFilter = eventId ? { eventId } : {};

    // 1. Total registrations & check-in counts
    const totalRegistrations = await prisma.eventRegistration.count({
      where: eventFilter,
    });

    const checkedInCount = await prisma.eventRegistration.count({
      where: {
        ...eventFilter,
        status: 'CHECKED_IN',
      },
    });

    // 2. Meal Entitlements
    const totalMeals = await prisma.entitlement.count({
      where: {
        category: 'MEAL',
        registration: eventFilter,
      },
    });

    const redeemedMeals = await prisma.entitlement.count({
      where: {
        category: 'MEAL',
        status: 'REDEEMED',
        registration: eventFilter,
      },
    });

    // 3. Session Entitlements
    const totalSessions = await prisma.entitlement.count({
      where: {
        category: 'SESSION',
        registration: eventFilter,
      },
    });

    const redeemedSessions = await prisma.entitlement.count({
      where: {
        category: 'SESSION',
        status: 'REDEEMED',
        registration: eventFilter,
      },
    });

    // 4. Recent Redemption Activity Logs (Last 15)
    const recentLogs = await prisma.redemptionLog.findMany({
      where: {
        registration: eventFilter,
      },
      orderBy: { scannedAt: 'desc' },
      take: 15,
      include: {
        registration: {
          include: {
            person: true,
            event: true,
          },
        },
        entitlement: true,
        operator: {
          select: { name: true, role: true },
        },
      },
    });

    return NextResponse.json({
      stats: {
        registrations: {
          total: totalRegistrations,
          checkedIn: checkedInCount,
          pending: totalRegistrations - checkedInCount,
          checkInRate: totalRegistrations > 0 ? Math.round((checkedInCount / totalRegistrations) * 100) : 0,
        },
        meals: {
          total: totalMeals,
          redeemed: redeemedMeals,
          available: totalMeals - redeemedMeals,
          rate: totalMeals > 0 ? Math.round((redeemedMeals / totalMeals) * 100) : 0,
        },
        sessions: {
          total: totalSessions,
          redeemed: redeemedSessions,
          available: totalSessions - redeemedSessions,
          rate: totalSessions > 0 ? Math.round((redeemedSessions / totalSessions) * 100) : 0,
        },
      },
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        scannedAt: log.scannedAt,
        result: log.result,
        deviceInfo: log.deviceInfo,
        notes: log.notes,
        participantName: `${log.registration.person.firstName} ${log.registration.person.lastName}`,
        ticketCode: log.registration.ticketCode,
        entitlementTitle: log.entitlement?.title || 'General Check-In',
        entitlementCategory: log.entitlement?.category || null,
        operatorName: log.operator?.name || 'Automated Station',
      })),
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to retrieve stats';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
