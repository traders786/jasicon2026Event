'use client';

import React from 'react';
import { JASICON_BRAND } from './badgeConstants';

interface TempleIllustrationProps {
  opacity?: number;
  heightPx?: number;
  mode?: 'footer' | 'watermark' | 'header-spire' | 'engraved';
}

export function TempleIllustration({
  opacity = 1.0,
  heightPx = 105,
  mode = 'engraved',
}: TempleIllustrationProps) {
  if (mode === 'header-spire') {
    // Elegant single gold temple spire for the back header
    return (
      <svg
        width="140"
        height="44"
        viewBox="0 0 140 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 0.75, display: 'block', margin: '0 auto' }}
      >
        {/* Central Spire */}
        <path d="M70 2 L70 8" stroke="#E8D5A3" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M68 8 L72 8 L70 12 Z" fill="#E8D5A3" />
        <path d="M64 16 L76 16 L74 13 L66 13 Z" fill="none" stroke="#E8D5A3" strokeWidth="1" />
        <path d="M61 22 L79 22 L76 17 L64 17 Z" fill="none" stroke="#E8D5A3" strokeWidth="1" />
        <path d="M58 29 L82 29 L79 23 L61 23 Z" fill="none" stroke="#E8D5A3" strokeWidth="1" />
        <path d="M54 37 L86 37 L82 30 L58 30 Z" fill="none" stroke="#E8D5A3" strokeWidth="1" />
        <path d="M51 44 L89 44 L86 38 L54 38 Z" fill="none" stroke="#E8D5A3" strokeWidth="1" />
        {/* Left Sub-Spire */}
        <path d="M42 22 L42 26" stroke="#E8D5A3" strokeWidth="0.8" />
        <path d="M38 31 L46 31 L44 27 L40 27 Z" fill="none" stroke="#E8D5A3" strokeWidth="0.8" />
        <path d="M34 39 L50 39 L47 32 L37 32 Z" fill="none" stroke="#E8D5A3" strokeWidth="0.8" />
        <path d="M31 44 L53 44 L50 40 L34 40 Z" fill="none" stroke="#E8D5A3" strokeWidth="0.8" />
        {/* Right Sub-Spire */}
        <path d="M98 22 L98 26" stroke="#E8D5A3" strokeWidth="0.8" />
        <path d="M94 31 L102 31 L100 27 L96 27 Z" fill="none" stroke="#E8D5A3" strokeWidth="0.8" />
        <path d="M90 39 L106 39 L103 32 L93 32 Z" fill="none" stroke="#E8D5A3" strokeWidth="0.8" />
        <path d="M87 44 L109 44 L106 40 L90 40 Z" fill="none" stroke="#E8D5A3" strokeWidth="0.8" />
      </svg>
    );
  }

  if (mode === 'watermark') {
    // Elegant side mandala / rangoli watermark pattern
    return (
      <div
        style={{
          position: 'absolute',
          top: '28%',
          bottom: '22%',
          left: 0,
          right: 0,
          backgroundImage: `url(${JASICON_BRAND.artwork.backTemplate})`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          opacity: 0.45,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
    );
  }

  // Authentic Engraved Deoghar Temple & Trees Artwork at the bottom
  return (
    <div
      style={{
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        opacity,
        display: 'block',
        lineHeight: 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={JASICON_BRAND.artwork.engravedTempleFooter}
        alt="Baidyanath Deoghar Temple & Trees Engraved Artwork"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          objectFit: 'cover',
          objectPosition: 'bottom center',
        }}
      />
    </div>
  );
}
