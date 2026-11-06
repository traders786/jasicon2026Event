'use client';

import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BadgeAttendeeData } from './badgeConstants';
import { BadgeFront } from './BadgeFront';
import { BadgeBack } from './BadgeBack';
import { generateBadgePdf, generateMasterBackPdf } from '@/lib/badge-pdf-generator';

export interface JASICONBadgeProps {
  attendee: BadgeAttendeeData;
  eventQrDataUrl: string;
  scientificProgrammeQrDataUrl: string;
  showLanyardSlots?: boolean;
  initialSide?: 'both' | 'front' | 'back';
  allowDownload?: boolean;
}

export function JASICONBadgeTemplate({
  attendee,
  eventQrDataUrl,
  scientificProgrammeQrDataUrl,
  showLanyardSlots = true,
  initialSide = 'both',
  allowDownload = true,
}: JASICONBadgeProps) {
  const [activeTab, setActiveTab] = useState<'both' | 'front' | 'back'>(initialSide);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingBackPdf, setIsExportingBackPdf] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = async () => {
    if (!frontRef.current) return;
    try {
      setIsExportingPdf(true);
      await generateBadgePdf({
        attendee,
        frontElement: frontRef.current,
        qrDataUrl: eventQrDataUrl,
        fileName: `Badge_${attendee.ticketCode}_${attendee.fullName.replace(/\s+/g, '_')}.pdf`,
      });
    } catch (err) {
      console.error('Failed to generate front PDF:', err);
      alert('Error generating print-ready PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadBackPdf = async () => {
    if (!backRef.current) return;
    try {
      setIsExportingBackPdf(true);
      await generateMasterBackPdf(backRef.current, scientificProgrammeQrDataUrl);
    } catch (err) {
      console.error('Failed to generate master back PDF:', err);
      alert('Error generating back-side PDF. Please try again.');
    } finally {
      setIsExportingBackPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="jasicon-badge-system-wrapper" style={{ margin: '0 auto', maxWidth: '880px' }}>
      {/* Control Toolbar (Hidden during print) */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: '#FFFFFF',
          padding: '10px 16px',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          marginBottom: '20px',
        }}
      >
        {/* Side switcher buttons */}
        <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '8px', padding: '3px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('both')}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'both' ? '#0B4333' : 'transparent',
              color: activeTab === 'both' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Side by Side
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('front')}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'front' ? '#0B4333' : 'transparent',
              color: activeTab === 'front' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Front Side
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('back')}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'back' ? '#0B4333' : 'transparent',
              color: activeTab === 'back' ? '#FFFFFF' : '#475569',
              transition: 'all 0.15s ease',
            }}
          >
            Back Side
          </button>
        </div>

        {/* Action Buttons */}
        {allowDownload && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Quick Print: Prints BOTH front and back on 2 clean pages */}
            <button
              type="button"
              onClick={handlePrint}
              title="Print Front and Back sides (exactly 2 clean pages, no page forms)"
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Quick Print (Front + Back)
            </button>

            {/* Download Master Back PDF (A6): Common to all attendees */}
            <button
              type="button"
              onClick={handleDownloadBackPdf}
              disabled={isExportingBackPdf}
              title="Download common reverse side PDF (A6 300 DPI) linking to https://jasicon2026.in/"
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
                cursor: isExportingBackPdf ? 'wait' : 'pointer',
                boxShadow: '0 2px 6px rgba(6, 75, 56, 0.2)',
              }}
            >
              {isExportingBackPdf ? (
                <>Generating Back PDF...</>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <rect x="7" y="7" width="3" height="3" />
                    <rect x="14" y="7" width="3" height="3" />
                    <rect x="7" y="14" width="3" height="3" />
                    <path d="M14 14h3v3h-3z" />
                  </svg>
                  Master Back PDF (A6)
                </>
              )}
            </button>

            {/* Download Attendee Front PDF (A6): Unique to this attendee */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              title="Download print-ready Front side PDF (105×148 mm A6, 300 DPI)"
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
                cursor: isExportingPdf ? 'wait' : 'pointer',
                boxShadow: '0 2px 6px rgba(160, 124, 46, 0.25)',
              }}
            >
              {isExportingPdf ? (
                <>Generating Front PDF...</>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download Front PDF (105×148 mm)
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* On-Screen Badge Preview Area */}
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
        {/* FRONT BADGE SECTION */}
        <div
          style={
            activeTab === 'both' || activeTab === 'front'
              ? { display: 'flex', flexDirection: 'column', alignItems: 'center' }
              : { position: 'absolute', left: '-99999px', top: '0', pointerEvents: 'none', visibility: 'hidden' }
          }
        >
          {/* Admin Preview Label (Hidden during print) */}
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
            FRONT &bull; ATTENDEE BADGE
          </div>

          <div ref={frontRef}>
            <BadgeFront
              attendee={attendee}
              qrDataUrl={eventQrDataUrl}
              showLanyardSlots={showLanyardSlots}
            />
          </div>
        </div>

        {/* BACK BADGE SECTION */}
        <div
          style={
            activeTab === 'both' || activeTab === 'back'
              ? { display: 'flex', flexDirection: 'column', alignItems: 'center' }
              : { position: 'absolute', left: '-99999px', top: '0', pointerEvents: 'none', visibility: 'hidden' }
          }
        >
          {/* Admin Preview Label (Hidden during print) */}
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
            BACK &bull; SCIENTIFIC PROGRAMME
          </div>

          <div ref={backRef}>
            <BadgeBack
              scientificProgrammeQrDataUrl={scientificProgrammeQrDataUrl}
              showLanyardSlots={showLanyardSlots}
            />
          </div>
        </div>
      </div>

      {/* Isolated Print Portal: Direct child of document.body for 100% clean 2-page print without form/nav leakage */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <div id="jasicon-portal-print">
          <div className="jasicon-print-page jasicon-print-page-front">
            <BadgeFront
              attendee={attendee}
              qrDataUrl={eventQrDataUrl}
              showLanyardSlots={showLanyardSlots}
            />
          </div>
          <div className="jasicon-print-page jasicon-print-page-back">
            <BadgeBack
              scientificProgrammeQrDataUrl={scientificProgrammeQrDataUrl}
              showLanyardSlots={showLanyardSlots}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
