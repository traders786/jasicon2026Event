import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSecureQrToken, renderQrCodeDataUrl } from '@/lib/qr';
import { ALL_ENTITLEMENT_DEFINITIONS } from '@/lib/constants';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const RegisterSchema = z.object({
  eventId: z.string().uuid(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  photoUrl: z.string().optional(),
});

import { getEventContext } from '@/lib/event-context';

export async function GET(request: Request) {
  try {
    const eventCtx = await getEventContext();
    const { searchParams } = new URL(request.url);
    const eventIdParam = searchParams.get('eventId');
    const search = searchParams.get('q')?.trim() || '';

    const whereClause: Prisma.EventRegistrationWhereInput = {};

    // Strict event scoping: Super Admin can specify event or uses active; Staff is locked to assigned event!
    const effectiveEventId = eventCtx?.isSuperAdmin
      ? (eventIdParam || eventCtx?.eventId)
      : eventCtx?.eventId;

    if (effectiveEventId) {
      whereClause.eventId = effectiveEventId;
    }

    if (search) {
      whereClause.OR = [
        { ticketCode: { contains: search, mode: 'insensitive' } },
        { person: { firstName: { contains: search, mode: 'insensitive' } } },
        { person: { lastName: { contains: search, mode: 'insensitive' } } },
        { person: { email: { contains: search, mode: 'insensitive' } } },
        { person: { company: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const allParam = searchParams.get('all');

    const isPaginated = allParam !== 'true';
    const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam || '25', 10) || 25));
    const skip = (page - 1) * limit;

    const [totalCount, registrations] = await Promise.all([
      prisma.eventRegistration.count({ where: whereClause }),
      prisma.eventRegistration.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        ...(isPaginated ? { skip, take: limit } : {}),
        include: {
          person: true,
          event: true,
          entitlements: {
            select: {
              id: true,
              category: true,
              code: true,
              title: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const items = registrations.map((r) => {
      const meals = r.entitlements.filter((e) => e.category === 'MEAL');
      const sessions = r.entitlements.filter((e) => e.category === 'SESSION');
      return {
        id: r.id,
        ticketCode: r.ticketCode,
        status: r.status,
        checkedInAt: r.checkedInAt,
        createdAt: r.createdAt,
        person: {
          id: r.person.id,
          name: `${r.person.firstName} ${r.person.lastName}`,
          email: r.person.email,
          phone: r.person.phone,
          company: r.person.company,
          jobTitle: r.person.jobTitle,
          photoUrl: r.person.photoUrl,
        },
        event: {
          id: r.event.id,
          title: r.event.title,
          venue: r.event.venue,
        },
        entitlementsSummary: {
          total: r.entitlements.length,
          mealsTotal: meals.length,
          mealsRedeemed: meals.filter((m) => m.status === 'REDEEMED').length,
          sessionsTotal: sessions.length,
          sessionsRedeemed: sessions.filter((s) => s.status === 'REDEEMED').length,
        },
      };
    });

    return NextResponse.json({
      registrations: items,
      pagination: {
        page: isPaginated ? page : 1,
        limit: isPaginated ? limit : totalCount,
        total: totalCount,
        totalPages: isPaginated ? Math.max(1, Math.ceil(totalCount / limit)) : 1,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve registrations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 });
    }

    const { eventId, firstName, lastName, email, phone, company, jobTitle, photoUrl } = parsed.data;

    // 1. Find or create Person
    const person = await prisma.person.upsert({
      where: { email: email.toLowerCase().trim() },
      update: {
        firstName,
        lastName,
        phone,
        company,
        jobTitle,
        ...(photoUrl ? { photoUrl } : {}),
      },
      create: {
        firstName,
        lastName,
        email: email.toLowerCase().trim(),
        phone,
        company,
        jobTitle,
        photoUrl: photoUrl || null,
      },
    });

    const eventCtx = await getEventContext();
    const targetEventId = eventCtx?.isSuperAdmin
      ? (eventId || eventCtx?.eventId)
      : eventCtx?.eventId;

    if (!targetEventId) {
      return NextResponse.json({ error: 'Valid conference context is required' }, { status: 400 });
    }

    // 2. Check if already registered for this event
    const existing = await prisma.eventRegistration.findUnique({
      where: {
        personId_eventId: {
          personId: person.id,
          eventId: targetEventId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This person is already registered for this conference.', ticketCode: existing.ticketCode },
        { status: 409 }
      );
    }

    // 3. Generate sequential ticket code with conference prefix without collision
    const prefix = eventCtx?.event?.ticketPrefix || 'JC-2026';
    const latestReg = await prisma.eventRegistration.findFirst({
      where: {
        eventId: targetEventId,
        ticketCode: { startsWith: `${prefix}-` },
      },
      orderBy: { ticketCode: 'desc' },
      select: { ticketCode: true },
    });
    let nextNum = 1;
    if (latestReg?.ticketCode) {
      const match = latestReg.ticketCode.match(new RegExp(`${prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}-(\\d+)`));
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const ticketCode = `${prefix}-${String(nextNum).padStart(4, '0')}`;

    // 4. Generate Zero-PII QR token
    const { plainToken, tokenHash } = generateSecureQrToken();

    // 5. Create registration and event entitlements in transaction
    const stationsToUse = (eventCtx?.event?.stations && eventCtx.event.stations.length > 0)
      ? eventCtx.event.stations.map((s) => ({
          category: s.category === 'SESSION' ? ('SESSION' as const) : ('MEAL' as const),
          code: s.code,
          title: s.label,
        }))
      : ALL_ENTITLEMENT_DEFINITIONS;

    const registration = await prisma.$transaction(async (tx) => {
      const reg = await tx.eventRegistration.create({
        data: {
          personId: person.id,
          eventId: targetEventId,
          ticketCode,
          qrTokenHash: tokenHash,
          status: 'CONFIRMED',
        },
      });

      const entitlementsData = stationsToUse.map((def) => ({
        registrationId: reg.id,
        category: def.category,
        code: def.code,
        title: def.title,
        status: 'AVAILABLE' as const,
        version: 0,
      }));

      await tx.entitlement.createMany({
        data: entitlementsData,
      });

      return reg;
    });

    // Generate QR image data URL for instant badge rendering
    const qrDataUrl = await renderQrCodeDataUrl(plainToken);

    return NextResponse.json(
      {
        success: true,
        registration: {
          id: registration.id,
          ticketCode: registration.ticketCode,
          status: registration.status,
          person: {
            id: person.id,
            name: `${person.firstName} ${person.lastName}`,
            email: person.email,
            phone: person.phone,
            company: person.company,
            jobTitle: person.jobTitle,
            photoUrl: photoUrl || person.photoUrl || null,
          },
        },
        qrToken: plainToken,
        qrDataUrl,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to register attendee';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
