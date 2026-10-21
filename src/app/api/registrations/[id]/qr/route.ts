import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { renderQrCodeDataUrl } from '@/lib/qr';

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
        entitlements: true,
      },
    });

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // Note: The plaintext token is only generated at registration time.
    // For badge re-printing, the ticket code or token is represented:
    const qrDataUrl = await renderQrCodeDataUrl(`EC_TICKET:${registration.ticketCode}:${registration.id}`);

    return NextResponse.json({
      registration: {
        id: registration.id,
        ticketCode: registration.ticketCode,
        status: registration.status,
        checkedInAt: registration.checkedInAt,
        person: {
          name: `${registration.person.firstName} ${registration.person.lastName}`,
          email: registration.person.email,
          company: registration.person.company,
          jobTitle: registration.person.jobTitle,
        },
        event: {
          title: registration.event.title,
          venue: registration.event.venue,
          startDate: registration.event.startDate,
          endDate: registration.event.endDate,
        },
        qrDataUrl,
      },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to retrieve ticket';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
