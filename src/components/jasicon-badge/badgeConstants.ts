/**
 * Centralized Brand & Geometry Constants for JASICON 2026 Master Conference Badge
 * 
 * Physical Specifications:
 * - Finished size: 105 mm × 148 mm (A6 portrait)
 * - Orientation: Portrait
 * - Print resolution: 300 DPI target
 * - Safe margin: 5 mm
 * - Bleed: 3 mm
 */

export const JASICON_BRAND = {
  // Conference Details
  conferenceTitle: '25TH ANNUAL CONFERENCE OF',
  mainHeading: 'JASICON 2026',
  subHeading: 'ASI JHARKHAND CHAPTER',
  editionText: '25TH ANNUAL STATE CONFERENCE',
  dateString: '20–22 NOVEMBER 2026',
  dateRangeDisplay: '20–22 NOVEMBER 2026',
  venueCity: 'DEOGHAR, JHARKHAND',
  venueFull: 'Deoghar, Jharkhand, India',
  websiteUrl: 'https://jasicon2026.in',
  scientificProgrammeUrl: 'https://jasicon2026.in/', // Direct conference home & scientific programme access
  
  // Color Palette (CMYK-Friendly Hex Codes)
  colors: {
    forestGreenDark: '#073226',
    forestGreenPrimary: '#0B4333',
    forestGreenLight: '#125A45',
    goldDark: '#A07C2E',
    goldPrimary: '#C5A059',
    goldLight: '#E8D5A3',
    goldMetallicGradient: 'linear-gradient(135deg, #ECC876 0%, #C5A059 50%, #9F7628 100%)',
    ivoryBackground: '#FAF8F3',
    ivoryCardGradient: 'linear-gradient(180deg, #FFFFFF 0%, #FAF7F0 60%, #F5F0E4 100%)',
    charcoalText: '#18231E',
    mutedText: '#4A5B53',
    white: '#FFFFFF',
    qrBorder: '#C5A059',
  },

  // Dimensions (in millimeters & standard screen rendering ratios)
  dimensions: {
    widthMm: 105,
    heightMm: 148,
    bleedMm: 3,
    safeMarginMm: 5,
    aspectRatio: '105 / 148',
    // Screen preview dimensions (scaled for comfortable viewing)
    previewWidthPx: 397, // ~105mm at 96 DPI
    previewHeightPx: 560, // ~148mm at 96 DPI
    // High-res print target at 300 DPI
    printWidthPx: 1240,
    printHeightPx: 1748,
  },

  // Logos (Fixed positions, no CSS redraws or proportions distortion)
  logos: {
    leftEmblem: '/branding/jasicon-emblem.png',       // Authentic circular Sushruta & robotics emblem
    centerMain: '/branding/jasicon-main-logo.jpg',     // 25th JASICON temple dome logo
    rightChapter: '/branding/asi-jharkhand-logo.png',  // Authentic ASI Jharkhand state chapter emblem
  },

  // Authentic Engraved Artworks
  artwork: {
    engravedTempleFooter: '/branding/master-front-card.png',
    backTemplate: '/branding/master-back-template.png',
  },
} as const;

export interface BadgeAttendeeData {
  attendeeId: string;
  ticketCode: string;
  fullName: string;
  category: string;
  photoUrl?: string | null;
  institution?: string | null;
  email?: string | null;
  phone?: string | null;
  qrPayload?: string;
  eventTitle?: string;
  venue?: string;
}
