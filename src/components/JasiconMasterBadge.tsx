'use client';

import React, { useRef, useState } from 'react';

export interface JasiconMasterBadgeProps {
  attendee: {
    fullName: string;
    category?: string;
    photoUrl?: string | null;
    ticketCode: string;
    phone?: string | null;
    email?: string | null;
    eventTitle?: string;
    venue?: string;
    status?: string;
  };
  qrDataUrl: string;
  scientificProgrammeQrDataUrl: string;
  initialSide?: 'both' | 'front' | 'back';
}

function formatDoctorName(rawName?: string): string {
  if (!rawName) return 'Dr. Delegate';
  const clean = rawName.trim().replace(/^dr\.?\s+/i, '').replace(/\s+/g, ' ');
  return `Dr. ${clean}`;
}

function getInitials(name?: string): string {
  if (!name) return 'DR';
  const clean = name.trim().replace(/^dr\.?\s+/i, '');
  const parts = clean.split(' ').filter(Boolean);
  if (parts.length === 0) return 'DR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function JasiconMasterBadge({
  attendee,
  qrDataUrl,
  scientificProgrammeQrDataUrl,
  initialSide = 'both',
}: JasiconMasterBadgeProps) {
  const [activeSide, setActiveSide] = useState<'both' | 'front' | 'back'>(initialSide);
  const [photoError, setPhotoError] = useState(false);
  const [downloadingFront, setDownloadingFront] = useState(false);
  const [downloadingBack, setDownloadingBack] = useState(false);

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  const formattedName = formatDoctorName(attendee.fullName);
  const initials = getInitials(attendee.fullName);
  const categoryText = (attendee.category || 'DELEGATE').toUpperCase();
  const ticketCode = attendee.ticketCode || 'JC-2026-0000';

  // Responsive font size for long names
  const nameLength = formattedName.length;
  const nameFontSize =
    nameLength > 28 ? '0.88rem' : nameLength > 22 ? '1.02rem' : nameLength > 16 ? '1.12rem' : '1.25rem';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async (side: 'front' | 'back') => {
    const targetElement = side === 'front' ? frontRef.current : backRef.current;
    if (!targetElement) return;

    if (side === 'front') setDownloadingFront(true);
    else setDownloadingBack(true);

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(targetElement, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#FAF8F3',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [105, 148],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, 105, 148);
      pdf.save(`JASICON-2026-Badge-${side.toUpperCase()}-${ticketCode}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
    } finally {
      if (side === 'front') setDownloadingFront(false);
      else setDownloadingBack(false);
    }
  };

  const handleSendWhatsApp = () => {
    let phone = attendee.phone?.trim() || '';
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
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const badgeUrl = `${origin}/badge/${ticketCode}`;

    const text = `Dear ${formattedName},

Greetings from JASICON 2026! 🏥✨
Here are your official conference registration and digital badge details:

📋 Delegate: ${formattedName}
🎫 Ticket Code: ${ticketCode}
🏛️ Conference: 25th Annual State Conference of ASI (JASICON 2026)
📍 Venue: Deoghar, Jharkhand
✅ Status: CONFIRMED

📱 View & Download your Official Master Badge & Scientific Programme online:
${badgeUrl}

Please present your QR code at the registration desk for check-in and access to conference meals & academic sessions.

Warm regards,
Organizing Committee, JASICON 2026`;

    window.open(`https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="jasicon-badge-system-wrapper" style={{ margin: '0 auto', maxWidth: '880px' }}>
      {/* Action Toolbar */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: '#FFFFFF',
          padding: '12px 18px',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)',
          marginBottom: '24px',
        }}
      >
        {/* Side Switcher */}
        <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '8px', padding: '3px' }}>
          <button
            type="button"
            onClick={() => setActiveSide('both')}
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeSide === 'both' ? '#0B4333' : 'transparent',
              color: activeSide === 'both' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Side by Side
          </button>
          <button
            type="button"
            onClick={() => setActiveSide('front')}
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeSide === 'front' ? '#0B4333' : 'transparent',
              color: activeSide === 'front' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Front Side
          </button>
          <button
            type="button"
            onClick={() => setActiveSide('back')}
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeSide === 'back' ? '#0B4333' : 'transparent',
              color: activeSide === 'back' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Back Side
          </button>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            🖨️ Quick Print (Front + Back)
          </button>
          <button
            type="button"
            onClick={() => handleDownloadPdf('back')}
            disabled={downloadingBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: '1px solid #064B38',
              background: '#064B38',
              color: '#FFFDF5',
              cursor: downloadingBack ? 'wait' : 'pointer',
              boxShadow: '0 2px 6px rgba(6, 75, 56, 0.2)',
            }}
          >
            📑 {downloadingBack ? 'Generating Back PDF...' : 'Master Back PDF (A6)'}
          </button>
          <button
            type="button"
            onClick={() => handleDownloadPdf('front')}
            disabled={downloadingFront}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              fontSize: '0.82rem',
              fontWeight: 800,
              borderRadius: '8px',
              border: '1px solid #A07C2E',
              background: 'linear-gradient(135deg, #ECC876 0%, #C5A059 60%, #A07C2E 100%)',
              color: '#073226',
              cursor: downloadingFront ? 'wait' : 'pointer',
              boxShadow: '0 2px 6px rgba(160, 124, 46, 0.25)',
            }}
          >
            📥 {downloadingFront ? 'Generating Front PDF...' : 'Download Front PDF (105×148 mm)'}
          </button>
          <button
            type="button"
            onClick={handleSendWhatsApp}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              background: '#25D366',
              color: '#FFFFFF',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)',
            }}
          >
            💬 Send to WhatsApp
          </button>
        </div>
      </div>

      {/* Badges Display Container */}
      <div
        className="jasicon-badge-render-container"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: '28px',
          margin: '0 auto',
        }}
      >
        {/* FRONT SIDE */}
        <div
          style={
            activeSide === 'both' || activeSide === 'front'
              ? { display: 'flex', flexDirection: 'column', alignItems: 'center' }
              : { position: 'absolute', left: '-99999px', top: '0', pointerEvents: 'none', visibility: 'hidden' }
          }
        >
          <div
            className="no-print"
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: '#0B4333',
              background: '#E6F4EA',
              border: '1px solid #CEEAD6',
              padding: '3px 10px',
              borderRadius: '12px',
              marginBottom: '10px',
              textTransform: 'uppercase',
            }}
          >
            FRONT • ATTENDEE BADGE
          </div>
          <div ref={frontRef}>
            <div
              className="jasicon-badge-card jasicon-badge-front"
              style={{
                width: '105mm',
                height: '148mm',
                maxWidth: '92vw',
                borderRadius: 0,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 12px 36px rgba(7, 50, 38, 0.22)',
                boxSizing: 'border-box',
                margin: '0 auto',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                border: '1.5px solid #C5A059',
                userSelect: 'none',
                background: '#FAF8F3',
                aspectRatio: '105 / 148',
              }}
            >
              {/* Master Front Artwork Background */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/branding/master-front-card.png?v=12"
                alt="JASICON 2026 Master Front Card Artwork"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />

              {/* Attendee Photo in Gold Frame */}
              <div
                style={{
                  position: 'absolute',
                  top: '39.02%',
                  left: '32.25%',
                  width: '35.50%',
                  height: '19.22%',
                  borderRadius: '18px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#FAF8F3',
                  border: '2px solid #C5A059',
                  boxSizing: 'border-box',
                  zIndex: 10,
                }}
              >
                {attendee.photoUrl && !photoError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attendee.photoUrl}
                    alt={formattedName}
                    onError={() => setPhotoError(true)}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center 20%',
                      display: 'block',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: '#FAF8F3',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: initials.length > 2 ? '1.9rem' : '2.4rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        fontFamily: '"Times New Roman", Times, Georgia, serif',
                        color: '#0B4333',
                        lineHeight: 1,
                      }}
                    >
                      {initials}
                    </span>
                  </div>
                )}
              </div>

              {/* Attendee Name */}
              <div
                style={{
                  position: 'absolute',
                  top: '60.50%',
                  left: '4%',
                  right: '4%',
                  height: '4.50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  zIndex: 10,
                  pointerEvents: 'none',
                }}
              >
                <h2
                  style={{
                    fontFamily: '"Times New Roman", Times, Georgia, serif',
                    fontSize: nameFontSize,
                    lineHeight: 1.1,
                    fontWeight: 800,
                    color: '#0F2C23',
                    margin: 0,
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {formattedName}
                </h2>
              </div>

              {/* Category Ribbon Pill */}
              <div
                style={{
                  position: 'absolute',
                  top: '66.25%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '44%',
                  height: '4.4%',
                  borderRadius: '20px',
                  backgroundColor: '#064B38',
                  border: '1.5px solid #C5A059',
                  boxShadow: '0 2px 6px rgba(6, 75, 56, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                  padding: '0 8px',
                }}
              >
                <span
                  style={{
                    color: '#FFFFFF',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    display: 'block',
                    lineHeight: 1,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {categoryText}
                </span>
              </div>

              {/* Event Access QR Code */}
              <div
                style={{
                  position: 'absolute',
                  top: '72.48%',
                  left: '16.21%',
                  width: '30.56%',
                  height: '18.99%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  boxSizing: 'border-box',
                  padding: '10px',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`Event Access QR for ${ticketCode}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    imageRendering: 'pixelated',
                    display: 'block',
                  }}
                />
              </div>

              {/* Ticket Code Text */}
              <div
                style={{
                  position: 'absolute',
                  top: '82.38%',
                  left: '53.55%',
                  width: '25.65%',
                  height: '3.80%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Consolas, Monaco, monospace, sans-serif',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    color: '#18231E',
                    lineHeight: 1,
                  }}
                >
                  {ticketCode}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BACK SIDE */}
        <div
          style={
            activeSide === 'both' || activeSide === 'back'
              ? { display: 'flex', flexDirection: 'column', alignItems: 'center' }
              : { position: 'absolute', left: '-99999px', top: '0', pointerEvents: 'none', visibility: 'hidden' }
          }
        >
          <div
            className="no-print"
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: '#064B38',
              background: '#FFF3D6',
              border: '1px solid #F9E2A8',
              padding: '3px 10px',
              borderRadius: '12px',
              marginBottom: '10px',
              textTransform: 'uppercase',
            }}
          >
            BACK • SCIENTIFIC PROGRAMME
          </div>
          <div ref={backRef}>
            <div
              className="jasicon-badge-card jasicon-badge-back"
              style={{
                width: '105mm',
                height: '148mm',
                maxWidth: '92vw',
                borderRadius: 0,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '0 12px 36px rgba(7, 50, 38, 0.22)',
                boxSizing: 'border-box',
                margin: '0 auto',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                border: '1.5px solid #C5A059',
                userSelect: 'none',
                background: '#FAF8F3',
                aspectRatio: '105 / 148',
              }}
            >
              {/* Master Back Artwork Background */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/branding/master-back-template.png?v=12"
                alt="JASICON 2026 Master Back Artwork"
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
              />

              {/* Scientific Programme QR Code */}
              {scientificProgrammeQrDataUrl && (
                <div
                  style={{
                    position: 'absolute',
                    top: '53.49%',
                    left: '38.31%',
                    width: '22.58%',
                    height: '16.02%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    boxSizing: 'border-box',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scientificProgrammeQrDataUrl}
                    alt="Scientific Programme QR Code"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      imageRendering: 'pixelated',
                      display: 'block',
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
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
        <div>Official Physical Card Dimensions: 105 mm × 148 mm (A6 Portrait) • 300 DPI Production Standard</div>
        <div style={{ marginTop: '4px' }}>
          Need assistance? Visit the Conference Registration Desk at Deoghar, Jharkhand.
        </div>
      </div>
    </div>
  );
}

