import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseSpreadsheet } from '@/lib/spreadsheet';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const placeholderPeople = await prisma.person.findMany({
      where: {
        OR: [
          { firstName: 'Guest', lastName: 'Participant' },
          { email: { contains: '@attendee.eventcheck.local' } },
        ],
      },
      include: {
        registrations: {
          select: {
            id: true,
            ticketCode: true,
            status: true,
            qrTokenHash: true,
            createdAt: true,
            _count: {
              select: { entitlements: true, redemptions: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const placeholderCount = placeholderPeople.length;
    const registrations = placeholderPeople.flatMap((p) => p.registrations);

    return NextResponse.json({
      placeholderCount,
      registrationsCount: registrations.length,
      sample: placeholderPeople.slice(0, 5).map((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        email: p.email,
        company: p.company,
        jobTitle: p.jobTitle,
        ticketCode: p.registrations[0]?.ticketCode,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to query placeholder records';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const contentType = request.headers.get('content-type') || '';
    let buffer: Buffer | null = null;
    let sheetName: string | undefined;
    let isConfirmed = false;
    let cleanupOrphan = true;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      sheetName = (formData.get('sheetName') as string) || undefined;
      isConfirmed = formData.get('confirmed') === 'true';
      cleanupOrphan = formData.get('cleanupOrphan') !== 'false';

      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'Please upload the original .xlsx, .xls, or .csv file to reconcile.' }, { status: 400 });
      }

      const fileObj = file as File;
      const arrayBuffer = await fileObj.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      const content = body.csvContent || body.content;
      sheetName = body.sheetName;
      isConfirmed = Boolean(body.confirmed);
      cleanupOrphan = body.cleanupOrphan !== false;

      if (!content || typeof content !== 'string') {
        return NextResponse.json({ error: 'Spreadsheet content is required.' }, { status: 400 });
      }
      buffer = Buffer.from(content, 'utf-8');
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type.' }, { status: 415 });
    }

    // 1. Parse spreadsheet
    const parseResult = parseSpreadsheet(buffer, { sheetName });
    if (parseResult.participants.length === 0) {
      return NextResponse.json({ error: 'No valid participants could be parsed from the provided spreadsheet.' }, { status: 400 });
    }

    // 2. Fetch existing placeholder registrations
    const placeholderRegistrations = await prisma.eventRegistration.findMany({
      where: {
        person: {
          OR: [
            { firstName: 'Guest', lastName: 'Participant' },
            { email: { contains: '@attendee.eventcheck.local' } },
          ],
        },
      },
      include: {
        person: true,
        _count: {
          select: { entitlements: true, redemptions: true },
        },
      },
      orderBy: { ticketCode: 'asc' },
    });

    if (placeholderRegistrations.length === 0) {
      return NextResponse.json({ message: 'No placeholder records found in the database. All records are already reconciled!' });
    }

    // 3. Match placeholder records against spreadsheet
    // In the earlier corrupted import, `company` stored the Serial Number / `Sl No.` (e.g. "119", "72", "41", "Sl No.")
    const diffPlan: Array<{
      registrationId: string;
      ticketCode: string;
      personId: string;
      isOrphanHeader: boolean;
      current: {
        name: string;
        email: string;
        phone: string | null;
        company: string | null;
        jobTitle: string | null;
      };
      reconciled?: {
        name: string;
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        company?: string;
        jobTitle?: string;
        regNo?: string;
      };
    }> = [];

    const usedSpreadsheetIndices = new Set<number>();

    for (const reg of placeholderRegistrations) {
      const comp = (reg.person.company || '').trim().toLowerCase();

      // Check if this is the accidentally imported header row
      if (comp === 'sl no.' || comp === 'sl no' || comp === 'sl.no' || comp === 'serial no') {
        diffPlan.push({
          registrationId: reg.id,
          ticketCode: reg.ticketCode,
          personId: reg.person.id,
          isOrphanHeader: true,
          current: {
            name: `${reg.person.firstName} ${reg.person.lastName}`,
            email: reg.person.email,
            phone: reg.person.phone,
            company: reg.person.company,
            jobTitle: reg.person.jobTitle,
          },
        });
        continue;
      }

      // Match by registration number
      let matchedIdx = -1;
      if (reg.person.company) {
        matchedIdx = parseResult.participants.findIndex(
          (p, idx) => !usedSpreadsheetIndices.has(idx) && p.registrationNo === reg.person.company
        );
      }

      // Fallback: match by sequential relative offset if reg numbers empty
      if (matchedIdx === -1) {
        matchedIdx = parseResult.participants.findIndex((_, idx) => !usedSpreadsheetIndices.has(idx));
      }

      if (matchedIdx >= 0) {
        usedSpreadsheetIndices.add(matchedIdx);
        const p = parseResult.participants[matchedIdx];
        diffPlan.push({
          registrationId: reg.id,
          ticketCode: reg.ticketCode,
          personId: reg.person.id,
          isOrphanHeader: false,
          current: {
            name: `${reg.person.firstName} ${reg.person.lastName}`,
            email: reg.person.email,
            phone: reg.person.phone,
            company: reg.person.company,
            jobTitle: reg.person.jobTitle,
          },
          reconciled: {
            name: p.fullName,
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            phone: p.phone,
            company: p.company,
            jobTitle: p.jobTitle,
            regNo: p.registrationNo,
          },
        });
      }
    }

    // 4. DRY RUN: Return diff preview without database mutations
    if (!isConfirmed) {
      const realMatches = diffPlan.filter((d) => !d.isOrphanHeader && d.reconciled);
      const orphanHeaders = diffPlan.filter((d) => d.isOrphanHeader);

      return NextResponse.json({
        success: true,
        dryRun: true,
        totalPlaceholderRecords: placeholderRegistrations.length,
        totalMatchedToSpreadsheet: realMatches.length,
        orphanHeaderRecordsCount: orphanHeaders.length,
        selectedSheet: parseResult.selectedSheet,
        diffPreview: diffPlan.slice(0, 15).map((d) => ({
          ticketCode: d.ticketCode,
          isOrphanHeader: d.isOrphanHeader,
          before: d.current,
          after: d.reconciled || null,
        })),
        allDiffs: diffPlan.map((d) => ({
          ticketCode: d.ticketCode,
          isOrphanHeader: d.isOrphanHeader,
          before: d.current,
          after: d.reconciled || null,
        })),
      });
    }

    // 5. CONFIRMED EXECUTION: Apply corrections safely
    let updatedCount = 0;
    let orphanCleanedCount = 0;

    for (const item of diffPlan) {
      if (item.isOrphanHeader && cleanupOrphan) {
        // Safe delete of accidental header-row registration
        await prisma.$transaction(async (tx) => {
          await tx.eventRegistration.delete({ where: { id: item.registrationId } });
          await tx.person.delete({ where: { id: item.personId } });
        });
        orphanCleanedCount++;
        continue;
      }

      if (item.reconciled) {
        // Update Person model with real attendee details
        // Keep unique email collision-safe
        const newEmail = item.reconciled.email.toLowerCase().trim();

        // Check if new email is already used by another person (excluding current person)
        const emailCollision = await prisma.person.findFirst({
          where: { email: newEmail, NOT: { id: item.personId } },
        });

        const safeEmail = emailCollision
          ? `${item.reconciled.phone || item.reconciled.regNo || 'attendee'}.${Date.now()}@attendee.eventcheck.local`
          : newEmail;

        await prisma.person.update({
          where: { id: item.personId },
          data: {
            firstName: item.reconciled.firstName,
            lastName: item.reconciled.lastName,
            email: safeEmail,
            phone: item.reconciled.phone || null,
            company: item.reconciled.company || null,
            jobTitle: item.reconciled.jobTitle || null,
          },
        });

        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      reconciledCount: updatedCount,
      orphanCleanedCount,
      message: `Successfully reconciled ${updatedCount} participant records. ${orphanCleanedCount} accidental header record cleaned up. All ticket codes, QR token hashes, and entitlements preserved!`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Reconciliation processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
