import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderQrCodeDataUrl } from '@/lib/qr';
import { RegistrationStatus } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { getEventContext } from '@/lib/event-context';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const registration = await prisma.eventRegistration.findUnique({
      where: { id },
      include: {
        person: true,
        event: true,
        entitlements: {
          orderBy: [{ category: 'asc' }, { code: 'asc' }],
        },
        redemptions: {
          orderBy: { scannedAt: 'desc' },
          take: 20,
          include: {
            entitlement: {
              select: {
                title: true,
                code: true,
                category: true,
              },
            },
            operator: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Participant registration not found' }, { status: 404 });
    }

    const eventCtx = await getEventContext();
    if (eventCtx && registration.eventId !== eventCtx.eventId) {
      return NextResponse.json(
        { error: 'Access Denied: Participant does not belong to your active conference.' },
        { status: 403 }
      );
    }

    // Standardized badge payload that works natively with the scanner
    const qrPayload = `EC_TICKET:${registration.ticketCode}:${registration.id}`;
    const qrDataUrl = await renderQrCodeDataUrl(qrPayload);

    const meals = registration.entitlements.filter((e) => e.category === 'MEAL');
    const sessions = registration.entitlements.filter((e) => e.category === 'SESSION');

    return NextResponse.json({
      registration: {
        id: registration.id,
        ticketCode: registration.ticketCode,
        status: registration.status,
        checkedInAt: registration.checkedInAt,
        createdAt: registration.createdAt,
        updatedAt: registration.updatedAt,
        qrPayload,
        qrDataUrl,
        person: {
          id: registration.person.id,
          name: `${registration.person.firstName} ${registration.person.lastName}`,
          firstName: registration.person.firstName,
          lastName: registration.person.lastName,
          email: registration.person.email,
          phone: registration.person.phone,
          company: registration.person.company,
          jobTitle: registration.person.jobTitle,
          photoUrl: registration.person.photoUrl,
        },
        event: {
          id: registration.event.id,
          title: registration.event.title,
          venue: registration.event.venue,
          startDate: registration.event.startDate,
          endDate: registration.event.endDate,
          logoUrl: registration.event.logoUrl,
        },
        entitlements: registration.entitlements.map((e) => ({
          id: e.id,
          code: e.code,
          title: e.title,
          category: e.category,
          status: e.status,
          redeemedAt: e.redeemedAt,
        })),
        meals,
        sessions,
        stats: {
          mealsTotal: meals.length,
          mealsRedeemed: meals.filter((m) => m.status === 'REDEEMED').length,
          sessionsTotal: sessions.length,
          sessionsRedeemed: sessions.filter((s) => s.status === 'REDEEMED').length,
          checkedIn: registration.status === 'CHECKED_IN',
        },
        recentActivity: registration.redemptions.map((log) => ({
          id: log.id,
          result: log.result,
          scannedAt: log.scannedAt,
          notes: log.notes,
          itemTitle: log.entitlement?.title || 'Event Check-in',
          operatorName: log.operator?.name || 'Staff Scanner',
        })),
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to retrieve participant details';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const registration = await prisma.eventRegistration.findUnique({
      where: { id },
      include: { person: true },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Participant registration not found' }, { status: 404 });
    }

    const eventCtx = await getEventContext();
    if (eventCtx && registration.eventId !== eventCtx.eventId) {
      return NextResponse.json(
        { error: 'Access Denied: Participant does not belong to your active conference.' },
        { status: 403 }
      );
    }

    // 1. Update Person fields if provided
    const personUpdates: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string | null;
      company?: string | null;
      jobTitle?: string | null;
      photoUrl?: string | null;
    } = {};

    if (body.firstName !== undefined) personUpdates.firstName = String(body.firstName).trim();
    if (body.lastName !== undefined) personUpdates.lastName = String(body.lastName).trim();
    if (body.email !== undefined) personUpdates.email = String(body.email).toLowerCase().trim();
    if (body.phone !== undefined) personUpdates.phone = body.phone ? String(body.phone).trim() : null;
    if (body.company !== undefined) personUpdates.company = body.company ? String(body.company).trim() : null;
    if (body.jobTitle !== undefined) personUpdates.jobTitle = body.jobTitle ? String(body.jobTitle).trim() : null;
    if (body.photoUrl !== undefined) personUpdates.photoUrl = body.photoUrl ? String(body.photoUrl).trim() : null;

    if (Object.keys(personUpdates).length > 0) {
      await prisma.person.update({
        where: { id: registration.person.id },
        data: personUpdates,
      });
    }

    // 2. Update Registration status if provided
    const regUpdates: {
      status?: RegistrationStatus;
      checkedInAt?: Date | null;
      ticketCode?: string;
    } = {};

    if (body.ticketCode !== undefined && String(body.ticketCode).trim()) {
      regUpdates.ticketCode = String(body.ticketCode).trim().toUpperCase();
    }

    if (body.status && Object.values(RegistrationStatus).includes(body.status)) {
      regUpdates.status = body.status as RegistrationStatus;
      if (body.status === 'CHECKED_IN' && !registration.checkedInAt) {
        regUpdates.checkedInAt = new Date();
      } else if (body.status !== 'CHECKED_IN') {
        regUpdates.checkedInAt = null;
      }
    }

    if (Object.keys(regUpdates).length > 0) {
      await prisma.eventRegistration.update({
        where: { id },
        data: regUpdates,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Participant updated successfully',
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to update participant';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;

    const registration = await prisma.eventRegistration.findUnique({
      where: { id },
      include: {
        person: true,
      },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Participant registration not found' }, { status: 404 });
    }

    const personId = registration.personId;
    const ticketCode = registration.ticketCode;
    const personName = `${registration.person.firstName} ${registration.person.lastName}`;

    // Transactional deletion of registration and its children
    await prisma.$transaction(async (tx) => {
      // 1. Delete associated entitlements
      await tx.entitlement.deleteMany({
        where: { registrationId: id },
      });

      // 2. Delete associated redemption logs
      await tx.redemptionLog.deleteMany({
        where: { registrationId: id },
      });

      // 3. Delete registration record
      await tx.eventRegistration.delete({
        where: { id },
      });

      // 4. Clean up Person if no other registrations exist
      const remainingRegs = await tx.eventRegistration.count({
        where: { personId },
      });
      if (remainingRegs === 0) {
        await tx.person.delete({
          where: { id: personId },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `Registration ${ticketCode} for ${personName} permanently deleted.`,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to delete registration';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
