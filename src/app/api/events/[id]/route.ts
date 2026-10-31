import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            registrations: true,
            users: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to retrieve event';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Super Administrator privileges required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const allowedFields = [
      'title',
      'subtitle',
      'organizerName',
      'venue',
      'city',
      'state',
      'ticketPrefix',
      'primaryColor',
      'accentColor',
      'logoUrl',
      'organizerLogoUrl',
      'categories',
      'stations',
      'whatsappTemplate',
      'isActive',
    ];

    const dataToUpdate: Record<string, any> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        dataToUpdate[field] = body[field];
      }
    }

    if (body.startDate) dataToUpdate.startDate = new Date(body.startDate);
    if (body.endDate) dataToUpdate.endDate = new Date(body.endDate);

    const updated = await prisma.event.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({ success: true, event: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to update event';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: 'Super Administrator privileges required' }, { status: 403 });
    }

    const { id } = await params;
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            registrations: true,
            users: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Conference event not found' }, { status: 404 });
    }

    // Atomic cascade deletion of all event data
    await prisma.$transaction(async (tx) => {
      // 1. Delete scan logs
      await tx.redemptionLog.deleteMany({
        where: {
          registration: {
            eventId: id,
          },
        },
      });

      // 2. Delete entitlements
      await tx.entitlement.deleteMany({
        where: {
          registration: {
            eventId: id,
          },
        },
      });

      // 3. Delete event registrations
      await tx.eventRegistration.deleteMany({
        where: {
          eventId: id,
        },
      });

      // 4. Unassign users
      await tx.user.updateMany({
        where: {
          assignedEventId: id,
        },
        data: {
          assignedEventId: null,
          assignedStationCode: null,
        },
      });

      // 5. Delete the event record
      await tx.event.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      message: `Conference "${event.title}" permanently deleted.`,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete event';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
