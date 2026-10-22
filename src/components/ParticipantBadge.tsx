'use client';

import React, { useRef, useState } from 'react';

export interface ParticipantBadgeProps {
  registrationId: string;
  ticketCode: string;
  status: string;
  person: {
    name: string;
    email: string;
    company?: string | null;
    jobTitle?: string | null;
    photoUrl?: string | null;
  };
  event: {
    title: string;
    venue: string;
    startDate?: string | Date;
    endDate?: string | Date;
  };
  qrDataUrl: string;
  qrPayload?: string;
  category?: string;
  onClose?: () => void;
}

export function ParticipantBadge({
  ticketCode,
  person,
  event,
  qrDataUrl,
  category = 'DELEGATE',
  onClose,
}: ParticipantBadgeProps) {
  const badgeCardRef = useRef<HTMLDivElement>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!badgeCardRef.current) return;
    setDownloadingPdf(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const element = badgeCardRef.current;
      const canvas = await html2canvas(element, {
        scale: 3, // High DPI capture for crisp printing
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');

      // Create PDF sized for standard conference badge (105mm x 155mm)
      const pdfWidth = 105;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, Math.max(pdfHeight, 150)],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Badge-${ticketCode}-${person.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      // Fallback to print dialog
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR-${ticketCode}-${person.name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Get initials for fallback avatar
  const initials = person.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');

  return (
    <div>
      {/* Action Toolbar (Hidden during print) */}
      <div className="no-print badge-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={handlePrint}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}
          >
            <span style={{ fontSize: '1.1rem' }}>🖨️</span>
            <span>Print Badge Now</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.92rem', fontWeight: 700 }}
          >
            <span>📄</span>
            <span>{downloadingPdf ? 'Generating PDF...' : 'Download Badge (PDF)'}</span>
          </button>
          <button
            onClick={handleDownloadQr}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}
          >
            <span>📥</span>
            <span>Download QR PNG</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ marginLeft: 'auto' }}
            >
              ✕ Close Preview
            </button>
          )}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          💡 Optimized for standard 4&quot; × 6&quot; conference badge cards, thermal badge printers, or standard A4/Letter sheets.
        </p>
      </div>

      {/* Printable Badge Container */}
      <div className="printable-badge-container">
        <div ref={badgeCardRef} className="conference-badge-card">
          {/* Lanyard punch guide */}
          <div className="badge-lanyard-slot no-print" title="Lanyard Hole Punch Indicator" />

          {/* Badge Header: Event Branding */}
          <div className="badge-header">
            <div className="badge-event-title">{event.title || 'JASICON 2026'}</div>
            <div className="badge-event-venue">{event.venue || 'Annual State Conference'}</div>
          </div>

          {/* Category Ribbon */}
          <div className="badge-category-strip">
            <span className="badge-category-text">{category}</span>
          </div>

          {/* Attendee Photo / Avatar */}
          <div className="badge-avatar-wrap">
            {person.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={person.photoUrl}
                alt={person.name}
                className="badge-photo-img"
              />
            ) : (
              <div className="badge-avatar-placeholder">
                <span>{initials || 'EC'}</span>
              </div>
            )}
          </div>

          {/* Attendee Info */}
          <div className="badge-attendee-info">
            <h1 className="badge-name">{person.name}</h1>
            {person.jobTitle && <div className="badge-job-title">{person.jobTitle}</div>}
            {person.company && <div className="badge-company">{person.company}</div>}
          </div>

          {/* High-Resolution QR Code */}
          <div className="badge-qr-section">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`QR code for ${ticketCode}`}
                className="badge-qr-img"
              />
            ) : (
              <div style={{ padding: '1.5rem', color: '#666', fontSize: '0.85rem' }}>
                Generating QR...
              </div>
            )}
            <div className="badge-ticket-code">{ticketCode}</div>
          </div>

          {/* Badge Footer */}
          <div className="badge-footer">
            <div className="badge-security-text">
              OFFICIAL EVENT ACCESS BADGE • SCAN AT ENTRANCE, MEALS &amp; SESSIONS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
