'use client';

import React, { useState } from 'react';
import { JASICON_BRAND, BadgeAttendeeData } from './badgeConstants';
import { formatAttendeeDisplayName, getFontSizeForName, generateInitials, hasValidPhoto } from './badgeUtils';

interface BadgeFrontProps {
  attendee: BadgeAttendeeData;
  qrDataUrl: string;
  showLanyardSlots?: boolean;
}

export function BadgeFront({
  attendee,
  qrDataUrl,
}: BadgeFrontProps) {
  const [photoError, setPhotoError] = useState(false);
  const displayName = formatAttendeeDisplayName(attendee.fullName);
  const nameStyle = getFontSizeForName(displayName);
  const categoryUpper = (attendee.category || 'DELEGATE').toUpperCase();
  const showPhoto = hasValidPhoto(attendee.photoUrl) && !photoError;
  const initials = generateInitials(attendee.fullName);

  return (
    <div
      className="jasicon-badge-card jasicon-badge-front"
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
      {/* 1. MASTER AUTHENTIC FRONT CARD BASE (Sharp 90-degree Rectangle, Covered Punchholes, Continuous Gold Wave) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/branding/master-front-card.png?v=15"
        alt="JASICON 2026 Master Front Card Artwork"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />

      {/* 2. DYNAMIC ATTENDEE PHOTO / INITIALS FRAME (top: 37.76%, left: 32.25%, width: 35.50%, height: 19.22%) */}
      <div
        style={{
          position: 'absolute',
          top: '37.76%',
          left: '32.25%',
          width: '35.50%',
          height: '19.22%',
          borderRadius: '18px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FAF8F3',
          border: `2px solid ${JASICON_BRAND.colors.goldPrimary}`,
          boxSizing: 'border-box',
          zIndex: 10,
        }}
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={attendee.photoUrl!}
            alt={attendee.fullName}
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

      {/* 3. DYNAMIC ATTENDEE NAME (Generous Clearance Above Pill, Zero Overlap) */}
      <div
        style={{
          position: 'absolute',
          top: '59.20%',
          left: '4%',
          right: '4%',
          height: '5.50%',
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
            fontSize: nameStyle.fontSize,
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
          {displayName}
        </h2>
      </div>

      {/* 4. DYNAMIC ATTENDEE CATEGORY PILL (Optically Centered Text) */}
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
          border: `1.5px solid ${JASICON_BRAND.colors.goldPrimary}`,
          boxShadow: '0 2px 6px rgba(6, 75, 56, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          pointerEvents: 'none',
          boxSizing: 'border-box',
          padding: '0 8px 1px 8px',
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
          {categoryUpper}
        </span>
      </div>

      {/* 5. DYNAMIC UNIQUE EVENT ACCESS QR CODE (Dead-Centered Inside Gold Box) */}
      {qrDataUrl && (
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
            padding: '12px',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`Event Access QR for ${attendee.ticketCode}`}
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

      {/* 6. DYNAMIC TICKET CODE PILL TEXT (Mathematically Centered at X = 66.98%, Y = 84.38%) */}
      <div
        style={{
          position: 'absolute',
          top: '82.40%',
          left: '53.39%',
          width: '27.18%',
          height: '3.95%',
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
          {attendee.ticketCode}
        </span>
      </div>
    </div>
  );
}
