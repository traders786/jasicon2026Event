'use client';

import React, { useRef, useState } from 'react';

export interface ParticipantBadgeProps {
  registrationId: string;
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
  const badgeCardRef = useRef<HTMLDivElement>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handlePrint = () => {
    if (!badgeCardRef.current) {
      window.print();
      return;
    }

    try {
      const existingIframe = document.getElementById('ec-single-page-print-frame');
      if (existingIframe) {
        existingIframe.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'ec-single-page-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = '800px';
      iframe.style.height = '1100px';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc) {
        window.print();
        return;
      }

      const badgeHtml = badgeCardRef.current.outerHTML;

      doc.open();
      doc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Badge_${ticketCode}</title>
    <style>
      @page {
        size: auto;
        margin: 5mm;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        visibility: visible !important;
      }
      html, body {
        background: #ffffff;
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .conference-badge-card {
        width: 86mm !important;
        max-width: 86mm !important;
        height: 125mm !important;
        max-height: 125mm !important;
        background: #ffffff !important;
        border: 2px solid #0d625e !important;
        border-radius: 12px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        text-align: center !important;
        overflow: hidden !important;
        position: relative !important;
        padding-bottom: 8px !important;
        margin: auto !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .badge-header {
        width: 100%;
        background: #0d625e !important;
        color: #ffffff !important;
        padding: 10px 8px 6px 8px;
        text-align: center;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .badge-header-with-logo {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 2mm !important;
        padding: 2.5mm 3.5mm !important;
      }
      .badge-logo-container {
        width: 12mm !important;
        height: 12mm !important;
        min-width: 12mm !important;
        min-height: 12mm !important;
        background: #ffffff !important;
        border-radius: 2mm !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 1mm !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25) !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        flex-shrink: 0 !important;
      }
      .badge-header-spacer {
        width: 12mm !important;
        min-width: 12mm !important;
        height: 1px !important;
        visibility: hidden !important;
        flex-shrink: 0 !important;
      }
      .badge-header-logo {
        max-width: 100% !important;
        max-height: 100% !important;
        object-fit: contain !important;
        display: block !important;
      }
      .badge-header-content {
        flex: 1 !important;
        min-width: 0 !important;
        text-align: center !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .badge-event-title {
        font-size: 12.5pt;
        font-weight: 900;
        text-transform: uppercase;
        color: #ffffff !important;
        line-height: 1.15;
        text-align: center !important;
      }
      .badge-event-venue {
        font-size: 7.5pt;
        color: #c9ede8 !important;
        margin-top: 2px;
        text-align: center !important;
      }
      .badge-category-strip {
        width: 100% !important;
        background: #059669 !important;
        color: #ffffff !important;
        height: 6.5mm !important;
        line-height: 6.5mm !important;
        padding: 0 !important;
        margin: 0 !important;
        box-sizing: border-box !important;
        text-align: center !important;
        overflow: hidden !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .badge-category-text {
        display: block !important;
        width: 100% !important;
        height: 6.5mm !important;
        line-height: 6.5mm !important;
        font-size: 7.5pt !important;
        font-weight: 800 !important;
        letter-spacing: 0.15em !important;
        text-transform: uppercase !important;
        color: #ffffff !important;
        text-align: center !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        background: transparent !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .badge-avatar-wrap {
        margin-top: 8px;
        width: 80px;
        height: 80px;
      }
      .badge-photo-img {
        width: 80px;
        height: 80px;
        border-radius: 14px;
        object-fit: cover;
        border: 2.5px solid #0d625e;
      }
      .badge-avatar-placeholder {
        width: 80px;
        height: 80px;
        border-radius: 14px;
        background: #0d625e !important;
        color: #ffffff !important;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24pt;
        font-weight: 800;
        border: 2.5px solid #0d625e;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .badge-attendee-info {
        margin-top: 6px;
        padding: 0 8px;
        width: 100%;
        text-align: center;
      }
      .badge-name {
        font-size: 13pt;
        font-weight: 900;
        color: #0f2927;
        line-height: 1.2;
      }
      .badge-job-title {
        font-size: 8.5pt;
        font-weight: 700;
        color: #0d625e;
      }
      .badge-company {
        font-size: 7.5pt;
        color: #64748b;
        margin-top: 1px;
      }
      .badge-qr-section {
        margin-top: 6px;
        display: flex;
        flex-direction: column;
        align-items: center;
        background: #f8fcfa !important;
        padding: 6px 10px 4px 10px;
        border-radius: 10px;
        border: 1px solid #dce7e4;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .badge-qr-img {
        width: 120px !important;
        height: 120px !important;
        display: block;
      }
      .badge-ticket-code {
        font-family: monospace;
        font-size: 9pt;
        font-weight: 800;
        color: #0d625e;
        letter-spacing: 0.08em;
        margin-top: 2px;
      }
      .no-print, .badge-lanyard-slot {
        display: none !important;
      }
    </style>
  </head>
  <body>
    <div class="printable-badge-container">
      ${badgeHtml}
    </div>
  </body>
</html>`);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          window.print();
        }
      }, 350);
    } catch {
      window.print();
    }
  };

  const handleSendWhatsApp = () => {
    let phone = person.phone?.trim() || '';
    if (!phone) {
      const input = window.prompt("Doctor's phone number is missing. Please enter their 10-digit mobile number for WhatsApp:", "");
      if (!input) return;
      phone = input.trim();
    }
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      alert('Please enter a valid mobile number with at least 10 digits.');
      return;
    }
    const formattedPhone = digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://eventt-nu.vercel.app';
    const badgeUrl = `${origin}/badge/${ticketCode}`;
    const cleanName = person.name.trim().replace(/^Dr\.?\s+/i, '');
    const displayName = `Dr. ${cleanName}`;
    const categoryText = (category || person.jobTitle || 'Delegate').toUpperCase();

    const confTitle = event?.title || 'Conference';
    const confVenue = event?.venue || '';

    const text = `Dear ${displayName},

Greetings from ${confTitle}! 🏥✨
Here are your official conference registration and digital badge details:

📋 Delegate: ${displayName}
🎫 Ticket Code: ${ticketCode}
🏛️ Conference: ${confTitle}
${confVenue ? `📍 Venue: ${confVenue}\n` : ''}✅ Status: CONFIRMED

📱 View & Download your Digital Badge & QR Code online:
${badgeUrl}

Please present your QR code at the registration desk for quick check-in and access to conference meals & academic sessions.

Warm regards,
Organizing Committee, ${confTitle}`;

    window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
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
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.9rem',
              fontWeight: 700,
              background: '#25D366',
              color: '#ffffff',
              border: 'none',
              boxShadow: '0 2px 8px rgba(37, 211, 102, 0.25)',
              cursor: 'pointer',
            }}
            title="Send conference badge and digital link to doctor on WhatsApp"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.696c1.001.554 1.833.821 2.806.821h.005c3.182 0 5.768-2.586 5.769-5.766.001-3.182-2.585-5.77-5.769-5.772zm3.377 8.169c-.14.394-.716.726-1.026.77-.31.045-.694.075-2.036-.45-1.579-.619-2.588-2.228-2.667-2.333-.078-.105-.644-.858-.644-1.637 0-.779.408-1.162.553-1.32.146-.157.319-.197.426-.197.106 0 .213 0 .306.005.099.006.232-.037.363.277.135.324.462 1.127.502 1.209.04.082.067.177.013.285-.053.107-.08.174-.159.266-.08.093-.167.207-.239.278-.08.08-.163.167-.07.327.093.16.413.682.887 1.103.61.543 1.124.71 1.284.79.16.08.253.067.347-.04.093-.107.4-466.507-.626.107-.16.213-.133.36-.08.146.053.931.439 1.091.518.16.08.267.12.307.186.04.067.04.387-.1 1.082z" />
            </svg>
            <span>Send to WhatsApp</span>
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

          {/* Badge Header: Event Branding (Dynamic Logo + Name or Clean Text) */}
          {event.logoUrl ? (
            <div
              className="badge-header badge-header-with-logo"
              style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '0.9rem 1.1rem 0.8rem 1.1rem',
                backgroundColor: '#0d625e',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div
                className="badge-logo-container"
                style={{
                  width: '48px',
                  height: '48px',
                  minWidth: '48px',
                  minHeight: '48px',
                  background: '#ffffff',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.logoUrl}
                  alt={event.title || 'Conference Logo'}
                  className="badge-header-logo"
                  crossOrigin="anonymous"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </div>
              <div
                className="badge-header-content"
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
              >
                <div
                  className="badge-event-title"
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 900,
                    letterSpacing: '-0.01em',
                    textTransform: 'uppercase',
                    color: '#ffffff',
                    lineHeight: 1.15,
                    textAlign: 'center',
                  }}
                >
                  {event.title || 'CONFERENCE 2026'}
                </div>
                <div
                  className="badge-event-venue"
                  style={{
                    fontSize: '0.8rem',
                    color: '#c9ede8',
                    fontWeight: 500,
                    marginTop: '2px',
                    textAlign: 'center',
                  }}
                >
                  {event.venue || 'Annual State Conference'}
                </div>
              </div>
              <div
                className="badge-header-spacer"
                aria-hidden="true"
                style={{
                  width: '48px',
                  minWidth: '48px',
                  height: '1px',
                  visibility: 'hidden',
                  flexShrink: 0,
                }}
              />
            </div>
          ) : (
            <div
              className="badge-header"
              style={{
                width: '100%',
                backgroundColor: '#0d625e',
                color: '#ffffff',
                padding: '1.2rem 1rem 0.9rem 1rem',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}
            >
              <div
                className="badge-event-title"
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 900,
                  letterSpacing: '-0.01em',
                  textTransform: 'uppercase',
                  color: '#ffffff',
                  lineHeight: 1.15,
                  textAlign: 'center',
                }}
              >
                {event.title || 'JASICON 2026'}
              </div>
              <div
                className="badge-event-venue"
                style={{
                  fontSize: '0.8rem',
                  color: '#c9ede8',
                  fontWeight: 500,
                  marginTop: '2px',
                  textAlign: 'center',
                }}
              >
                {event.venue || 'Annual State Conference'}
              </div>
            </div>
          )}

          {/* Category Ribbon (Vertically Centered across Screen, html2canvas, and Print) */}
          <div
            className="badge-category-strip"
            style={{
              width: '100%',
              backgroundColor: '#059669',
              color: '#ffffff',
              height: '28px',
              lineHeight: '28px',
              textAlign: 'center',
              boxSizing: 'border-box',
              padding: 0,
              margin: 0,
              overflow: 'hidden',
              display: 'block',
            }}
          >
            <span
              className="badge-category-text"
              style={{
                display: 'block',
                width: '100%',
                height: '28px',
                lineHeight: '28px',
                fontSize: '0.82rem',
                fontWeight: 800,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: '#ffffff',
                textAlign: 'center',
                margin: 0,
                padding: 0,
                border: 'none',
                background: 'transparent',
                boxShadow: 'none',
                borderRadius: 0,
              }}
            >
              {category}
            </span>
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
        </div>
      </div>
    </div>
  );
}
