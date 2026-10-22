import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getSession();

    // 1. Check DB connectivity & latency
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startTime;

    // 2. Fetch table counts
    const [
      userCount,
      personCount,
      registrationCount,
      checkedInCount,
      totalEntitlements,
      redeemedEntitlements,
      mealEntitlements,
      redeemedMeals,
      sessionEntitlements,
      redeemedSessions,
      logCount,
      eventInfo,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.person.count(),
      prisma.eventRegistration.count(),
      prisma.eventRegistration.count({ where: { status: 'CHECKED_IN' } }),
      prisma.entitlement.count(),
      prisma.entitlement.count({ where: { status: 'REDEEMED' } }),
      prisma.entitlement.count({ where: { category: 'MEAL' } }),
      prisma.entitlement.count({ where: { category: 'MEAL', status: 'REDEEMED' } }),
      prisma.entitlement.count({ where: { category: 'SESSION' } }),
      prisma.entitlement.count({ where: { category: 'SESSION', status: 'REDEEMED' } }),
      prisma.redemptionLog.count(),
      prisma.event.findFirst({ select: { id: true, title: true, slug: true, venue: true, isActive: true } }),
    ]);

    return NextResponse.json({
      status: 'healthy',
      database: {
        engine: 'PostgreSQL 16',
        host: '127.0.0.1',
        port: 5433,
        name: 'eventcheck_dev',
        latencyMs: dbLatencyMs,
        connectionState: 'Connected & Active',
        orm: 'Prisma Client 6.19.3',
      },
      counts: {
        users: userCount,
        participants: personCount,
        registrations: registrationCount,
        checkedIn: checkedInCount,
        entitlements: {
          total: totalEntitlements,
          redeemed: redeemedEntitlements,
          available: totalEntitlements - redeemedEntitlements,
          meals: { total: mealEntitlements, redeemed: redeemedMeals },
          sessions: { total: sessionEntitlements, redeemed: redeemedSessions },
        },
        auditLogs: logCount,
      },
      event: eventInfo,
      currentUser: session
        ? {
            name: session.name,
            email: session.email,
            role: session.role,
          }
        : null,
      apiEndpoints: [
        { method: 'POST', path: '/api/auth/login', description: 'User login & HTTP-only HMAC session creation' },
        { method: 'GET', path: '/api/auth/me', description: 'Session validation & role check' },
        { method: 'GET', path: '/api/dashboard/stats', description: 'Live KPI metrics and recent redemption audit' },
        { method: 'GET', path: '/api/registrations', description: 'List and search event registrations' },
        { method: 'POST', path: '/api/registrations', description: 'Create walk-in attendee with 19 entitlements' },
        { method: 'POST', path: '/api/scan', description: 'Atomic QR token verification & redemption' },
        { method: 'GET', path: '/api/users', description: 'Staff user accounts management (Admin only)' },
      ],
      prismaStudioCommand: 'npx prisma studio',
      prismaStudioUrl: 'http://localhost:5555',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    return NextResponse.json(
      {
        status: 'error',
        error: message,
        database: {
          engine: 'PostgreSQL 16',
          host: '127.0.0.1',
          port: 5433,
          name: 'eventcheck_dev',
          connectionState: 'Disconnected or Unreachable',
        },
      },
      { status: 500 }
    );
  }
}
