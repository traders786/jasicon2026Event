import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { renderQrCodeDataUrl } from '@/lib/qr';
import { ParticipantBadge } from '@/components/ParticipantBadge';
import type { Metadata } from 'next';

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
  const title = `🏥 Dr. ${name} (${category}) - Official Badge`;
  const description = `Ticket: ${registration.ticketCode} • Category: ${category} • 25th Annual Conference of ASI, Deoghar, Jharkhand`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ['/evently-logo.jpg'],
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

  const qrDataUrl = await renderQrCodeDataUrl(
    `EC_TICKET:${registration.ticketCode}:${registration.id}`
  );

  return (
    <div style={{ minHeight: '100vh', padding: '1.5rem 1rem', background: '#f0fdf9' }}>
      <div style={{ maxWidth: '440px', margin: '0 auto' }}>
        {/* Attendee Welcome Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }} className="no-print">
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: '#ffffff',
              boxShadow: '0 4px 14px rgba(13, 98, 94, 0.12)',
              border: '1px solid #dce7e4',
              marginBottom: '0.75rem',
              overflow: 'hidden',
              padding: '4px',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/evently-logo.jpg"
              alt="Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-heading)', margin: 0 }}>
            Official Conference Badge
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 700, marginTop: '4px' }}>
            {registration.event.title}{registration.event.venue ? ` • ${registration.event.venue}` : ''}
          </p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Present this digital badge &amp; QR code at the desk for check-in &amp; meals.
          </p>
        </div>

        {/* Badge Component */}
        <ParticipantBadge
          registrationId={registration.id}
          ticketCode={registration.ticketCode}
          status={registration.status}
          person={{
            name: `${registration.person.firstName} ${registration.person.lastName}`.trim(),
            email: registration.person.email,
            company: registration.person.company,
            jobTitle: registration.person.jobTitle,
            photoUrl: registration.person.photoUrl,
          }}
          event={{
            title: registration.event.title,
            venue: registration.event.venue,
            startDate: registration.event.startDate,
            endDate: registration.event.endDate,
            logoUrl: registration.event.logoUrl,
          }}
          qrDataUrl={qrDataUrl}
          category={registration.person.jobTitle || 'DELEGATE'}
        />

        {/* Footer info */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }} className="no-print">
          <div>25th Annual State Conference of ASI Jharkhand</div>
          <div>Need assistance? Visit the Conference Helpdesk at the venue.</div>
        </div>
      </div>
    </div>
  );
}
