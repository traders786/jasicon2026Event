import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseSpreadsheet } from '@/lib/spreadsheet';
import { ALL_ENTITLEMENT_DEFINITIONS } from '@/lib/constants';
import { generateSecureQrToken } from '@/lib/qr';
import { requireAdmin } from '@/lib/auth';
import { getEventContext } from '@/lib/event-context';

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const contentType = request.headers.get('content-type') || '';
    let buffer: Buffer | null = null;
    let sheetName: string | undefined;
    let isPreview = false;
    let reqEventId: string | undefined;

    // A. Handle Multipart Form Data (File Upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      sheetName = (formData.get('sheetName') as string) || undefined;
      isPreview = formData.get('preview') === 'true';
      reqEventId = (formData.get('eventId') as string) || undefined;

      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'No valid file uploaded. Please upload a .xlsx, .xls, or .csv file.' }, { status: 400 });
      }

      const fileObj = file as File;
      const arrayBuffer = await fileObj.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);

      // Validate file size (10 MB limit)
      if (buffer.length > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'File exceeds maximum allowed size of 10 MB.' }, { status: 400 });
      }
    }
    // B. Handle JSON Body (Pasted CSV / Text content)
    else if (contentType.includes('application/json')) {
      const body = await request.json();
      const content = body.csvContent || body.content;
      sheetName = body.sheetName;
      isPreview = Boolean(body.preview);
      reqEventId = body.eventId;

      if (!content || typeof content !== 'string') {
        return NextResponse.json({ error: 'Spreadsheet or CSV content is required.' }, { status: 400 });
      }
      buffer = Buffer.from(content, 'utf-8');
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type. Expected multipart/form-data or application/json.' }, { status: 415 });
    }

    // 1. Resolve active Event
    let eventId = reqEventId;
    let eventRecord = null;
    if (eventId) {
      eventRecord = await prisma.event.findUnique({ where: { id: eventId } });
    }
    if (!eventRecord) {
      const eventCtx = await getEventContext();
      if (eventCtx) {
        eventId = eventCtx.eventId;
        eventRecord = eventCtx.event;
      }
    }
    if (!eventRecord || !eventId) {
      const fallbackEvent = await prisma.event.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!fallbackEvent) {
        return NextResponse.json({ error: 'No active event found. Please configure an active event.' }, { status: 404 });
      }
      eventId = fallbackEvent.id;
      eventRecord = fallbackEvent;
    }

    // 2. Parse spreadsheet using universal engine
    const parseResult = parseSpreadsheet(buffer, { sheetName });

    if (parseResult.participants.length === 0) {
      return NextResponse.json({
        error: 'No valid attendee records could be parsed. Please check column headers.',
        headersDetected: parseResult.headers,
        sheetNames: parseResult.sheetNames,
        selectedSheet: parseResult.selectedSheet,
        invalidRows: parseResult.invalidRows,
      }, { status: 400 });
    }

    // 3. Check existing participants to estimate duplicates
    const emails = parseResult.participants.map((p) => p.email.toLowerCase().trim());
    const existingPeople = await prisma.person.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });
    const existingPersonIds = existingPeople.map((p) => p.id);
    const existingRegistrations = await prisma.eventRegistration.findMany({
      where: {
        eventId,
        personId: { in: existingPersonIds },
      },
      select: { personId: true },
    });
    const alreadyRegisteredIds = new Set(existingRegistrations.map((r) => r.personId));
    const duplicateEmailSet = new Set(
      existingPeople.filter((p) => alreadyRegisteredIds.has(p.id)).map((p) => p.email)
    );

    // If PREVIEW requested: return mapped data and validation without mutating DB
    if (isPreview) {
      return NextResponse.json({
        success: true,
        preview: true,
        sheetNames: parseResult.sheetNames,
        selectedSheet: parseResult.selectedSheet,
        headerRowIndex: parseResult.headerRowIndex,
        detectedHeaders: parseResult.headers,
        columnMapping: parseResult.columnMapping,
        totalRows: parseResult.participants.length,
        potentialDuplicates: duplicateEmailSet.size,
        invalidRows: parseResult.invalidRows,
        previewRows: parseResult.participants.slice(0, 10).map((p) => ({
          ...p,
          isDuplicate: duplicateEmailSet.has(p.email),
        })),
      });
    }

    // 4. Execute Commit: Import participants with 19 entitlements
    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Retrieve highest current ticket number to maintain sequence without collisions
    const prefix = (eventRecord as any)?.ticketPrefix || 'CONF-2026';
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
    let nextTicketNumber = maxNum + 1;

    for (let i = 0; i < parseResult.participants.length; i++) {
      const row = parseResult.participants[i];
      try {
        // Upsert person
        const person = await prisma.person.upsert({
          where: { email: row.email },
          update: {
            firstName: row.firstName,
            lastName: row.lastName,
            phone: row.phone || null,
            company: row.company || null,
            jobTitle: row.jobTitle || null,
          },
          create: {
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email,
            phone: row.phone || null,
            company: row.company || null,
            jobTitle: row.jobTitle || null,
          },
        });

        // Check if already registered
        const existing = await prisma.eventRegistration.findUnique({
          where: {
            personId_eventId: {
              personId: person.id,
              eventId,
            },
          },
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        const { tokenHash } = generateSecureQrToken();

        const stationsList =
          Array.isArray((eventRecord as any)?.stations) && (eventRecord as any).stations.length > 0
            ? (eventRecord as any).stations
            : ALL_ENTITLEMENT_DEFINITIONS;

        let createdReg = null;
        let attempts = 0;
        while (attempts < 10) {
          const candidateCode = `${prefix}-${String(nextTicketNumber).padStart(4, '0')}`;
          try {
            createdReg = await prisma.eventRegistration.create({
              data: {
                personId: person.id,
                eventId,
                ticketCode: candidateCode,
                qrTokenHash: tokenHash,
                status: 'CONFIRMED',
                entitlements: {
                  create: stationsList.map((def: any) => ({
                    code: def.code,
                    title: def.label || def.title,
                    category: def.category || (def.code.includes('MEAL') ? 'MEAL' : 'SESSION'),
                    status: 'AVAILABLE' as const,
                    version: 0,
                  })),
                },
              },
            });
            nextTicketNumber++;
            break;
          } catch (err: any) {
            const isUniqueError = err?.code === 'P2002';
            const isTicketCode = isUniqueError && (
              err?.meta?.target?.includes?.('ticketCode') ||
              String(err?.message || '').includes('ticketCode')
            );
            if (isTicketCode) {
              nextTicketNumber++;
              attempts++;
              continue;
            }
            throw err;
          }
        }

        if (!createdReg) {
          throw new Error('Failed to allocate unique ticket code');
        }

        importedCount++;
      } catch (err: unknown) {
        skippedCount++;
        const msg = err instanceof Error ? err.message : 'Import failed';
        errors.push(`Row ${row.rowNumber} (${row.fullName}): ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      importedCount,
      skippedCount,
      totalProcessed: parseResult.participants.length,
      errors: errors.slice(0, 10),
      selectedSheet: parseResult.selectedSheet,
      headers: parseResult.headers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Bulk import processing failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
