'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { JASICONBadgeTemplate } from './jasicon-badge/JASICONBadgeTemplate';
import { JASICON_BRAND } from './jasicon-badge/badgeConstants';

export interface ParticipantBadgeProps {
  registrationId?: string;
  ticketCode: string;
  status: string;
  person: {
    name: string;
    email: string;
    phone?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    photoUrl?: string | null;
  };
  event: {
    title: string;
    venue: string;
    startDate?: string | Date;
    endDate?: string | Date;
    logoUrl?: string | null;
  };
  qrDataUrl: string;
  qrPayload?: string;
  category?: string;
  onClose?: () => void;
}

export function ParticipantBadge({
  ticketCode,
  status,
  person,
  event,
  qrDataUrl,
  category = 'DELEGATE',
  onClose,
}: ParticipantBadgeProps) {
  const [scientificProgrammeQr, setScientificProgrammeQr] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(JASICON_BRAND.scientificProgrammeUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: { dark: '#073226', light: '#FFFFFF' },
    })
      .then(setScientificProgrammeQr)
      .catch((err) => console.error('Error generating programme QR:', err));
  }, []);

  const attendeeData = {
    attendeeId: ticketCode,
    ticketCode,
    fullName: person.name,
    category: (category || person.jobTitle || 'DELEGATE').toUpperCase(),
    photoUrl: person.photoUrl,
    institution: person.company,
    email: person.email,
    phone: person.phone,
    eventTitle: event.title,
    venue: event.venue,
  };

  return (
    <div style={{ padding: '0.5rem 0' }}>
      <JASICONBadgeTemplate
        attendee={attendeeData}
        eventQrDataUrl={qrDataUrl}
        scientificProgrammeQrDataUrl={scientificProgrammeQr}
        showLanyardSlots={true}
        initialSide="both"
        allowDownload={true}
      />
    </div>
  );
}
