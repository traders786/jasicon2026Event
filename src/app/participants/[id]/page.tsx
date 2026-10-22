import { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ParticipantProfileView } from '@/components/ParticipantProfileView';
export const instant = false;

export const metadata: Metadata = {
  title: 'Attendee Profile & Badge | EventCheck',
  description: 'View attendee details, QR code, entitlements, and print conference badge.',
};

export default async function ParticipantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div style={{ paddingTop: '0.75rem', paddingBottom: '3rem' }}>
      {/* Navigation Breadcrumb (Hidden during badge print) */}
      <div className="no-print" style={{ marginBottom: '1.25rem' }}>
        <Link
          href="/participants"
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span>←</span>
          <span>Back to All Participants</span>
        </Link>
      </div>

      <Suspense fallback={<div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Attendee Profile...</div>}>
        <ParticipantProfileView participantId={id} />
      </Suspense>
    </div>
  );
}
