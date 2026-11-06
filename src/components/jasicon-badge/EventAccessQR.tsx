'use client';

import React from 'react';
import { JASICON_BRAND } from './badgeConstants';

interface EventAccessQRProps {
  qrDataUrl: string;
  ticketCode: string;
  qrSizePx?: number;
}

export function EventAccessQR({
  qrDataUrl,
  ticketCode,
  qrSizePx = 92,
}: EventAccessQRProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '6px 14px',
        background: '#FFFFFF',
        borderRadius: '12px',
        border: `1.5px solid ${JASICON_BRAND.colors.goldLight}`,
        boxShadow: '0 3px 10px rgba(11, 67, 51, 0.08)',
        maxWidth: '310px',
        margin: '0 auto',
      }}
    >
      {/* High-Resolution QR Code */}
      <div
        style={{
          width: `${qrSizePx}px`,
          height: `${qrSizePx}px`,
          minWidth: `${qrSizePx}px`,
          minHeight: `${qrSizePx}px`,
          padding: '4px',
          background: '#FFFFFF',
          borderRadius: '8px',
          border: `1px solid ${JASICON_BRAND.colors.goldPrimary}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxSizing: 'border-box',
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
          }}
        />
      </div>

      {/* Label and Ticket ID */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          textAlign: 'left',
          flex: 1,
        }}
      >
        <span
          style={{
            fontSize: '0.62rem',
            fontWeight: 800,
            letterSpacing: '0.12em',
            color: JASICON_BRAND.colors.forestGreenPrimary,
            textTransform: 'uppercase',
            lineHeight: 1.15,
          }}
        >
          EVENT
        </span>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: JASICON_BRAND.colors.forestGreenPrimary,
            textTransform: 'uppercase',
            marginBottom: '6px',
            lineHeight: 1.15,
          }}
        >
          ACCESS QR
        </span>

        {/* Dynamic Registration ID Pill */}
        <div
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            background: 'linear-gradient(135deg, #FFF9EA 0%, #F6ECCF 100%)',
            border: `1.5px solid ${JASICON_BRAND.colors.goldPrimary}`,
            borderRadius: '6px',
            boxShadow: '0 1px 3px rgba(160, 124, 46, 0.15)',
          }}
        >
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              fontFamily: 'Consolas, Monaco, monospace, sans-serif',
              letterSpacing: '0.06em',
              color: JASICON_BRAND.colors.charcoalText,
              display: 'block',
              lineHeight: 1.2,
            }}
          >
            {ticketCode}
          </span>
        </div>
      </div>
    </div>
  );
}

