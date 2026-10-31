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
  accompanyingPersons: z.array(z.object({
    name: z.string(),
    relation: z.string().optional(),
  })).optional(),
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
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              company: true,
              jobTitle: true,
              photoUrl: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              venue: true,
            },
          },
          entitlements: {
            select: {
              category: true,
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
        accompanyingPersons: (r.accompanyingPersons as any[]) || [],
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

    const { eventId, firstName, lastName, email, phone, company, jobTitle, photoUrl, accompanyingPersons } = parsed.data;

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

    // 3. Retrieve actual target conference event to access its specific ticketPrefix and stations
    const targetEvent = await prisma.event.findUnique({
      where: { id: targetEventId },
    });

    if (!targetEvent) {
      return NextResponse.json({ error: 'Target conference not found' }, { status: 404 });
    }

    const prefix = targetEvent.ticketPrefix || eventCtx?.event?.ticketPrefix || 'CONF-2026';

    // Query all existing ticket codes starting with this prefix across the entire table
    // (ticketCode has a global unique constraint across all registrations)
    const existingWithPrefix = await prisma.eventRegistration.findMany({
      where: {
        ticketCode: { startsWith: `${prefix}-` },
      },
      select: { ticketCode: true },
    });

    let maxNum = 0;
    const prefixEscaped = prefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`^${prefixEscaped}-(\\d+)$`);
    for (const reg of existingWithPrefix) {
      const match = reg.ticketCode.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    let nextNum = maxNum + 1;

    // 4. Generate Zero-PII QR token
    const { plainToken, tokenHash } = generateSecureQrToken();

    // 5. Determine stations to provision
    const stationsToUse = (Array.isArray(targetEvent.stations) && targetEvent.stations.length > 0)
      ? (targetEvent.stations as any[]).map((s: any) => ({
          category: s.category === 'SESSION' ? ('SESSION' as const) : ('MEAL' as const),
          code: s.code,
          title: s.label || s.title || s.code,
        }))
      : (eventCtx?.event?.stations && eventCtx.event.stations.length > 0)
        ? eventCtx.event.stations.map((s) => ({
            category: s.category === 'SESSION' ? ('SESSION' as const) : ('MEAL' as const),
            code: s.code,
            title: s.label,
          }))
        : ALL_ENTITLEMENT_DEFINITIONS;

    // 6. Create registration and event entitlements in transaction with collision-retry
    let registration: any = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 10;

    while (attempts < MAX_ATTEMPTS) {
      const ticketCode = `${prefix}-${String(nextNum).padStart(4, '0')}`;
      try {
        registration = await prisma.$transaction(async (tx) => {
          const reg = await tx.eventRegistration.create({
            data: {
              personId: person.id,
              eventId: targetEventId,
              ticketCode,
              qrTokenHash: tokenHash,
              status: 'CONFIRMED',
              accompanyingPersons: accompanyingPersons && accompanyingPersons.length > 0 ? (accompanyingPersons as any) : Prisma.JsonNull,
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
        break; // Successfully registered!
      } catch (err: any) {
        const isUniqueError = err?.code === 'P2002';
        const isTicketCode = isUniqueError && (
          err?.meta?.target?.includes?.('ticketCode') ||
          String(err?.message || '').includes('ticketCode')
        );
        if (isTicketCode) {
          nextNum++;
          attempts++;
          continue;
        }
        throw err;
      }
    }

    if (!registration) {
      return NextResponse.json(
        { error: 'Failed to assign a unique ticket code after multiple attempts. Please try again.' },
        { status: 500 }
      );
    }

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
