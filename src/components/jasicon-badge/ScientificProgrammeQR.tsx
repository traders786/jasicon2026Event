'use client';

import React from 'react';
import { JASICON_BRAND } from './badgeConstants';

interface ScientificProgrammeQRProps {
  qrDataUrl: string;
  programmeUrl?: string;
  sizePx?: number;
}

export function ScientificProgrammeQR({
  qrDataUrl,
  programmeUrl = JASICON_BRAND.scientificProgrammeUrl,
  sizePx = 148,
}: ScientificProgrammeQRProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {/* QR Code Container with 4 Golden Corner Framing Brackets */}
      <div
        style={{
          width: `${sizePx + 24}px`,
          height: `${sizePx + 24}px`,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          boxSizing: 'border-box',
        }}
      >
        {/* Top-Left Corner Bracket */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            left: '4px',
            width: '18px',
            height: '18px',
            borderTop: `3px solid ${JASICON_BRAND.colors.goldPrimary}`,
            borderLeft: `3px solid ${JASICON_BRAND.colors.goldPrimary}`,
            borderTopLeftRadius: '6px',
          }}
        />
        {/* Top-Right Corner Bracket */}
        <div
          style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            width: '18px',
            height: '18px',
            borderTop: `3px solid ${JASICON_BRAND.colors.goldPrimary}`,
            borderRight: `3px solid ${JASICON_BRAND.colors.goldPrimary}`,
            borderTopRightRadius: '6px',
          }}
        />
        {/* Bottom-Left Corner Bracket */}
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            left: '4px',
            width: '18px',
            height: '18px',
            borderBottom: `3px solid ${JASICON_BRAND.colors.goldPrimary}`,
            borderLeft: `3px solid ${JASICON_BRAND.colors.goldPrimary}`,
            borderBottomLeftRadius: '6px',
          }}
        />
        {/* Bottom-Right Corner Bracket */}
        <div
          style={{
            position: 'absolute',
            bottom: '4px',
            right: '4px',
            width: '18px',
            height: '18px',
            borderBottom: `3px solid ${JASICON_BRAND.colors.goldPrimary}`,
            borderRight: `3px solid ${JASICON_BRAND.colors.goldPrimary}`,
            borderBottomRightRadius: '6px',
          }}
        />

        {/* The QR Module */}
        <div
          style={{
            width: `${sizePx}px`,
            height: `${sizePx}px`,
            background: '#FFFFFF',
            borderRadius: '8px',
            padding: '6px',
            boxShadow: '0 4px 14px rgba(11, 67, 51, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="JASICON 2026 Scientific Programme QR"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              imageRendering: 'pixelated',
            }}
          />
        </div>
      </div>

      {/* Thin Gold Divider */}
      <div
        style={{
          width: '75%',
          height: '1px',
          background: `linear-gradient(90deg, transparent 0%, ${JASICON_BRAND.colors.goldPrimary} 50%, transparent 100%)`,
          marginTop: '10px',
          marginBottom: '8px',
        }}
      />

      {/* Website URL pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: JASICON_BRAND.colors.forestGreenPrimary,
          fontSize: '0.86rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>jasicon2026.in</span>
      </div>
    </div>
  );
}

