'use client';

import React from 'react';
import { JASICON_BRAND } from './badgeConstants';

interface BadgeBackProps {
  scientificProgrammeQrDataUrl: string;
  showLanyardSlots?: boolean;
}

export function BadgeBack({
  scientificProgrammeQrDataUrl,
}: BadgeBackProps) {
  return (
    <div
      className="jasicon-badge-card jasicon-badge-back"
      style={{
        width: '105mm',
        height: '148mm',
        maxWidth: '105mm',
        maxHeight: '148mm',
        borderRadius: 0,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 12px 36px rgba(7, 50, 38, 0.22)',
        boxSizing: 'border-box',
        margin: '0 auto',
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        border: `1.5px solid ${JASICON_BRAND.colors.goldPrimary}`,
        userSelect: 'none',
        background: '#FAF8F3',
        aspectRatio: '105 / 148',
      }}
    >
      {/* 1. MASTER AUTHENTIC BACK ARTWORK (Sharp 90-degree Rectangle, Covered Punchholes, Smooth Parchment Gradient) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/branding/master-back-template.png?v=13"
        alt="JASICON 2026 Master Back Artwork"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />

      {/* 2. DYNAMIC COMMON SCIENTIFIC PROGRAMME QR CODE */}
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
  );
}
