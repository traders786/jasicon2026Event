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
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    const search = searchParams.get('q')?.trim() || '';

    const whereClause: Prisma.EventRegistrationWhereInput = {};
    if (eventId) whereClause.eventId = eventId;
    if (search) {
      whereClause.OR = [
        { ticketCode: { contains: search, mode: 'insensitive' } },
        { person: { firstName: { contains: search, mode: 'insensitive' } } },
        { person: { lastName: { contains: search, mode: 'insensitive' } } },
        { person: { email: { contains: search, mode: 'insensitive' } } },
        { person: { company: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const registrations = await prisma.eventRegistration.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
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
    });

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

    return NextResponse.json({ registrations: items });
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

    const { eventId, firstName, lastName, email, phone, company, jobTitle } = parsed.data;

    // 1. Find or create Person
    const person = await prisma.person.upsert({
      where: { email: email.toLowerCase().trim() },
      update: {
        firstName,
        lastName,
        phone,
        company,
        jobTitle,
      },
      create: {
        firstName,
        lastName,
        email: email.toLowerCase().trim(),
        phone,
        company,
        jobTitle,
      },
    });

    // 2. Check if already registered for this event
    const existing = await prisma.eventRegistration.findUnique({
      where: {
        personId_eventId: {
          personId: person.id,
          eventId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This person is already registered for this event.', ticketCode: existing.ticketCode },
        { status: 409 }
      );
    }

    // 3. Generate sequential ticket code without collision
    const latestReg = await prisma.eventRegistration.findFirst({
      where: { ticketCode: { startsWith: 'EC-2026-' } },
      orderBy: { ticketCode: 'desc' },
      select: { ticketCode: true },
    });
    let nextNum = 1;
    if (latestReg?.ticketCode) {
      const match = latestReg.ticketCode.match(/EC-2026-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const ticketCode = `EC-2026-${String(nextNum).padStart(4, '0')}`;

    // 4. Generate Zero-PII QR token
    const { plainToken, tokenHash } = generateSecureQrToken();

    // 5. Create registration and 19 entitlements in transaction
    const registration = await prisma.$transaction(async (tx) => {
      const reg = await tx.eventRegistration.create({
        data: {
          personId: person.id,
          eventId,
          ticketCode,
          qrTokenHash: tokenHash,
          status: 'CONFIRMED',
        },
      });

      const entitlementsData = ALL_ENTITLEMENT_DEFINITIONS.map((def) => ({
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
            name: `${person.firstName} ${person.lastName}`,
            email: person.email,
            company: person.company,
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
