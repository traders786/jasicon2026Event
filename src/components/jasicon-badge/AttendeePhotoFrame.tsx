'use client';

import React, { useState } from 'react';
import { generateInitials, hasValidPhoto } from './badgeUtils';
import { JASICON_BRAND } from './badgeConstants';

interface AttendeePhotoFrameProps {
  fullName: string;
  photoUrl?: string | null;
  sizePx?: number;
}

export function AttendeePhotoFrame({
  fullName,
  photoUrl,
  sizePx = 114,
}: AttendeePhotoFrameProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = hasValidPhoto(photoUrl) && !imgFailed;
  const initials = generateInitials(fullName);

  return (
    <div
      style={{
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        minWidth: `${sizePx}px`,
        minHeight: `${sizePx}px`,
        borderRadius: '16px',
        border: `2.5px solid ${JASICON_BRAND.colors.goldPrimary}`,
        background: '#FFFFFF',
        boxShadow: '0 6px 16px rgba(11, 67, 51, 0.14)',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
        flexShrink: 0,
      }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl!}
          alt={fullName}
          onError={() => setImgFailed(true)}
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
            background: 'linear-gradient(145deg, #FAF7EE 0%, #F3ECDC 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: JASICON_BRAND.colors.forestGreenPrimary,
            userSelect: 'none',
          }}
        >
          <span
            style={{
              fontSize: initials.length > 2 ? '1.75rem' : '2.1rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
              fontFamily: '"Times New Roman", Times, Georgia, serif',
              lineHeight: 1,
              textShadow: '0 1px 2px rgba(197, 160, 89, 0.25)',
            }}
          >
            {initials}
          </span>
          <span
            style={{
              fontSize: '0.55rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: JASICON_BRAND.colors.goldDark,
              marginTop: '4px',
            }}
          >
            JASICON 2026
          </span>
        </div>
      )}
    </div>
  );
}

