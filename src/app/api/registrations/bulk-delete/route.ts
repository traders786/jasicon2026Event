import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  return handleBulkDelete(request);
}

export async function DELETE(request: Request) {
  return handleBulkDelete(request);
}

async function handleBulkDelete(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Please select at least one participant to delete.' }, { status: 400 });
    }

    // Perform atomic transactional deletion
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find personIds associated with these registrations for orphan cleanup
      const registrations = await tx.eventRegistration.findMany({
        where: { id: { in: ids } },
        select: { id: true, personId: true, ticketCode: true },
      });

      if (registrations.length === 0) {
        return { deletedCount: 0 };
      }

      const validRegistrationIds = registrations.map((r) => r.id);
      const personIds = Array.from(new Set(registrations.map((r) => r.personId)));

      // 2. Delete all associated entitlements
      await tx.entitlement.deleteMany({
        where: { registrationId: { in: validRegistrationIds } },
      });

      // 3. Delete all associated redemption logs
      await tx.redemptionLog.deleteMany({
        where: { registrationId: { in: validRegistrationIds } },
      });

      // 4. Delete the event registration records
      const deleteResult = await tx.eventRegistration.deleteMany({
        where: { id: { in: validRegistrationIds } },
      });

      // 5. Clean up orphan Person records who no longer have any active registrations
      for (const personId of personIds) {
        const remainingCount = await tx.eventRegistration.count({
          where: { personId },
        });
        if (remainingCount === 0) {
          await tx.person.delete({
            where: { id: personId },
          }).catch(() => {});
        }
      }

      return { deletedCount: deleteResult.count };
    });

    return NextResponse.json({
      success: true,
      count: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} participant registration(s).`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to bulk delete participants';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
