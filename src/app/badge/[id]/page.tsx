import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { renderQrCodeDataUrl } from '@/lib/qr';
import { JASICONBadgeTemplate } from '@/components/jasicon-badge/JASICONBadgeTemplate';
import { JASICON_BRAND } from '@/components/jasicon-badge/badgeConstants';
import type { Metadata } from 'next';
import Link from 'next/link';

export const instant = false;

interface BadgePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: BadgePageProps): Promise<Metadata> {
  const { id } = await params;
  const registration = await prisma.eventRegistration.findFirst({
    where: {
      OR: [
        { id },
        { ticketCode: { equals: id, mode: 'insensitive' } },
      ],
    },
    include: { person: true, event: true },
  });

  if (!registration) {
    return { title: 'Conference Badge | JASICON 2026' };
  }

  const name = `${registration.person.firstName} ${registration.person.lastName}`.trim();
  const category = (registration.person.jobTitle || 'DELEGATE').toUpperCase();
  const title = `🏥 Dr. ${name} (${category}) - Official JASICON 2026 Badge`;
  const description = `Ticket: ${registration.ticketCode} • Category: ${category} • 25th Annual Conference of ASI Jharkhand Chapter, Deoghar`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [JASICON_BRAND.logos.centerMain],
    },
  };
}

export default async function BadgeViewPage({ params }: BadgePageProps) {
  const { id } = await params;

  // Find registration by ID or ticket code
  const registration = await prisma.eventRegistration.findFirst({
    where: {
      OR: [
        { id },
        { ticketCode: { equals: id, mode: 'insensitive' } },
      ],
    },
    include: {
      person: true,
      event: true,
    },
  });

  if (!registration) {
    notFound();
  }

  // 1. Generate unique Front Event Access QR code (tied to Evently check-in system)
  const eventQrPayload = `EC_TICKET:${registration.ticketCode}:${registration.id}`;
  const eventQrDataUrl = await renderQrCodeDataUrl(eventQrPayload);

  // 2. Generate common Back Scientific Programme QR code (fixed identical URL)
  const scientificProgrammeQrDataUrl = await renderQrCodeDataUrl(
    JASICON_BRAND.scientificProgrammeUrl
  );

  const fullName = `${registration.person.firstName} ${registration.person.lastName}`.trim();
  const category = (registration.person.jobTitle || 'DELEGATE').toUpperCase();

  const attendeeData = {
    attendeeId: registration.person.id,
    ticketCode: registration.ticketCode,
    fullName,
    category,
    photoUrl: registration.person.photoUrl,
    institution: registration.person.company,
    email: registration.person.email,
    phone: registration.person.phone,
    qrPayload: eventQrPayload,
    eventTitle: registration.event.title,
    venue: registration.event.venue,
  };

  return (
    <div style={{ minHeight: '100vh', padding: '2rem 1rem', background: '#F8FAF9' }}>
      {/* Top Banner Navigation */}
      <div
        className="no-print"
        style={{
          maxWidth: '860px',
          margin: '0 auto 1.5rem auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <Link
          href="/participants"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.85rem',
            color: '#0B4333',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Attendee Directory
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 800,
              background: '#E6F4EA',
              color: '#137333',
              border: '1px solid #CEEAD6',
            }}
          >
            ● {registration.status}
          </span>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 800,
              background: '#FEF7E0',
              color: '#B06000',
              border: '1px solid #FEEFC3',
            }}
          >
            {registration.ticketCode}
          </span>
        </div>
      </div>

      {/* Main Master Badge Template */}
      <JASICONBadgeTemplate
        attendee={attendeeData}
        eventQrDataUrl={eventQrDataUrl}
        scientificProgrammeQrDataUrl={scientificProgrammeQrDataUrl}
        showLanyardSlots={true}
        initialSide="both"
        allowDownload={true}
      />

      {/* Bottom Footer Details */}
      <div
        className="no-print"
        style={{
          textAlign: 'center',
          marginTop: '2.5rem',
          fontSize: '0.8rem',
          color: '#64748B',
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 700, color: '#0B4333' }}>
          25th Annual State Conference of ASI Jharkhand Chapter (JASICON 2026)
        </div>
        <div>
          Official Physical Card Dimensions: 105 mm × 148 mm (A6 Portrait) • 300 DPI Production Standard
        </div>
        <div style={{ marginTop: '4px' }}>
          Need assistance? Visit the Conference Registration Desk at Deoghar, Jharkhand.
        </div>
      </div>
    </div>
  );
}
