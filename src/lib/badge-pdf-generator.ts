import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { JASICON_BRAND, BadgeAttendeeData } from '@/components/jasicon-badge/badgeConstants';
import {
  generateInitials,
  formatAttendeeDisplayName,
  hasValidPhoto,
} from '@/components/jasicon-badge/badgeUtils';

export interface GenerateBadgePdfOptions {
  attendee: BadgeAttendeeData;
  frontElement?: HTMLElement;
  backElement?: HTMLElement;
  qrDataUrl?: string;
  fileName?: string;
  frontOnly?: boolean;
}

/**
 * Loads an image by URL or data URI and resolves with the HTMLImageElement once fully decoded.
 */
export function loadCanvasImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${src.slice(0, 60)}... (${e})`));
    img.src = src;
  });
}

/**
 * Safely draws a rounded rectangle path compatible across all modern and older browser canvas engines.
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draws an image with object-fit: cover semantics inside a rectangular canvas boundary.
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  const imgRatio = imgW / imgH;
  const targetRatio = w / h;

  let sW = imgW;
  let sH = imgH;
  let sx = 0;
  let sy = 0;

  if (imgRatio > targetRatio) {
    sW = imgH * targetRatio;
    sx = (imgW - sW) / 2;
  } else {
    sH = imgW / targetRatio;
    sy = (imgH - sH) / 2;
  }

  ctx.drawImage(img, sx, sy, sW, sH, x, y, w, h);
}

/**
 * Pure Canvas 2D Badge Front Renderer (300 DPI Native, 1240 × 1748 px)
 * Completely eliminates html2canvas flexbox/baseline misalignment bugs.
 * Renders mathematical subpixel-centered typography, category pill, QR, and photo/initials.
 */
export async function renderBadgeFrontToCanvas(
  attendee: BadgeAttendeeData,
  qrDataUrl?: string,
  frontElement?: HTMLElement
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1748;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to obtain canvas 2D rendering context');

  // 1. Load Master Background Artwork (A6 Portrait 300 DPI, Sharp 90-degree Corners)
  const masterBase = await loadCanvasImage('/branding/master-front-card.png?v=12');
  ctx.drawImage(masterBase, 0, 0, 1240, 1748);

  // 2. Photo / Initials Frame (top: 39.02%, left: 32.25%, width: 35.50%, height: 19.22%)
  const frameX = 400; // 32.25% of 1240 = 399.9
  const frameY = 682; // 39.02% of 1748 = 682.0
  const frameW = 440; // 35.50% of 1240 = 440.2
  const frameH = 336; // 19.22% of 1748 = 335.9
  const frameRadius = 36;

  let photoRendered = false;
  if (hasValidPhoto(attendee.photoUrl)) {
    try {
      const photoImg = await loadCanvasImage(attendee.photoUrl!);
      ctx.save();
      drawRoundedRect(ctx, frameX, frameY, frameW, frameH, frameRadius);
      ctx.clip();
      drawImageCover(ctx, photoImg, frameX, frameY, frameW, frameH);
      ctx.restore();
      photoRendered = true;
    } catch (err) {
      console.warn('Canvas badge renderer: Photo failed to load, falling back to initials:', err);
    }
  }

  if (!photoRendered) {
    // Elegant warm ivory background with bold forest-green initials
    ctx.save();
    ctx.fillStyle = '#FAF8F3';
    drawRoundedRect(ctx, frameX, frameY, frameW, frameH, frameRadius);
    ctx.fill();

    const initials = generateInitials(attendee.fullName);
    ctx.fillStyle = '#064B38';
    ctx.font = '800 100px "Times New Roman", Times, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, frameX + frameW / 2, frameY + frameH / 2);
    ctx.restore();
  }

  // Stroke crisp gold border around photo/initials frame
  ctx.save();
  ctx.strokeStyle = '#C5A059';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, frameX, frameY, frameW, frameH, frameRadius);
  ctx.stroke();
  ctx.restore();

  // 3. Attendee Full Name (Centered at y = 1070)
  // Generous 70-pixel ivory breathing space between name and category pill
  const displayName = formatAttendeeDisplayName(attendee.fullName).toUpperCase();
  ctx.save();
  ctx.fillStyle = '#0F2C23';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Base font size is 44px; scale down dynamically if name is especially long
  let fontSize = 44;
  ctx.font = `800 ${fontSize}px "Times New Roman", Times, Georgia, serif`;
  const maxNameWidth = 1050;
  const measuredWidth = ctx.measureText(displayName).width;
  if (measuredWidth > maxNameWidth) {
    fontSize = Math.floor(fontSize * (maxNameWidth / measuredWidth));
    ctx.font = `800 ${fontSize}px "Times New Roman", Times, Georgia, serif`;
  }
  ctx.fillText(displayName, 620, 1070);
  ctx.restore();

  // 4. Dynamic Category Pill (top: 66.25%, height: 4.4%, width: 44%)
  // Bounds: x: 347..893, y: 1158..1235 (height = 77px)
  const pillW = 546;
  const pillH = 77;
  const pillX = 620 - pillW / 2; // 347
  const pillY = 1158;
  const pillRadius = 38;

  ctx.save();
  ctx.fillStyle = '#064B38';
  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillRadius);
  ctx.fill();

  ctx.strokeStyle = '#C5A059';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillRadius);
  ctx.stroke();

  // Category Text: Perfectly centered at y = 1196.5
  const categoryUpper = (attendee.category || 'DELEGATE').toUpperCase();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(categoryUpper, 620, pillY + pillH / 2);
  ctx.restore();

  // 5. Event Access QR Code (slot: x: 236..579, y: 1267..1573)
  let effectiveQr = qrDataUrl;
  if (!effectiveQr && frontElement) {
    const qrImgEl = frontElement.querySelector<HTMLImageElement>('img[alt*="Event Access QR"], img[src^="data:image"]');
    if (qrImgEl?.src) {
      effectiveQr = qrImgEl.src;
    }
  }

  if (effectiveQr) {
    try {
      const qrImg = await loadCanvasImage(effectiveQr);
      // Dead-center in gold box x: 201..580 (center 390.5), y: 1267..1599 (center 1433)
      const qrSize = 286;
      const qrX = 247; // 46px left, 47px right margin
      const qrY = 1290; // 23px top, 23px bottom margin
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch (err) {
      console.warn('Canvas badge renderer: Failed to draw QR image:', err);
    }
  }

  // 6. Dynamic Ticket Code Text inside Ticket Box (top: 82.38%, left: 53.55%, width: 25.65%, height: 3.80%)
  // Bounds: x: 664..982, y: 1440..1506
  const ticketPillX = 664;
  const ticketPillY = 1440;
  const ticketPillW = 318;
  const ticketPillH = 66;

  ctx.save();
  ctx.fillStyle = '#18231E';
  ctx.font = '800 28px Consolas, Monaco, "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(attendee.ticketCode, ticketPillX + ticketPillW / 2, ticketPillY + ticketPillH / 2);
  ctx.restore();

  return canvas;
}

/**
 * Pure Canvas 2D Badge Back Renderer (300 DPI Native, 1240 × 1748 px)
 * Renders master back template with scientific programme QR code.
 */
export async function renderBadgeBackToCanvas(
  scientificProgrammeQr?: string,
  backElement?: HTMLElement
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1748;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to obtain canvas 2D rendering context');

  // 1. Draw Master Back Template Artwork
  const backBase = await loadCanvasImage('/branding/master-back-template.png?v=12');
  ctx.drawImage(backBase, 0, 0, 1240, 1748);

  // 2. Scientific Programme QR Code (slot: x: 391..839, y: 885..1265)
  let effectiveQr = scientificProgrammeQr;
  if (!effectiveQr && backElement) {
    const qrImgEl = backElement.querySelector<HTMLImageElement>('img[alt*="Scientific Programme"], img[src^="data:image"]');
    if (qrImgEl?.src) {
      effectiveQr = qrImgEl.src;
    }
  }

  if (effectiveQr) {
    try {
      const qrImg = await loadCanvasImage(effectiveQr);
      // Clean square QR inside single unified white slot, mathematically centered with generous white padding
      const qrSize = 280;
      const qrX = 475; // Center X = 615 (slot x: 391..839, margin = 84px on left and right)
      const qrY = 935; // Center Y = 1075 (slot y: 885..1265, margin = 50px on top and bottom)
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch (err) {
      console.warn('Canvas badge renderer: Failed to draw back QR image:', err);
    }
  }

  return canvas;
}

/**
 * Generates an exact-dimension, 300-DPI-quality PDF for physical attendee badge printing:
 * Outputs 1 Page: Front side (105 mm × 148 mm A6 Portrait) with sharp 90-degree corners.
 */
export async function generateBadgePdf({
  attendee,
  frontElement,
  qrDataUrl,
  fileName,
}: GenerateBadgePdfOptions): Promise<Blob> {
  const widthMm = JASICON_BRAND.dimensions.widthMm;
  const heightMm = JASICON_BRAND.dimensions.heightMm;

  // Exact A6 Portrait PDF instance in mm units
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true,
  });

  // Render direct to 300 DPI native Canvas 2D (zero flexbox baseline bugs)
  const frontCanvas = await renderBadgeFrontToCanvas(attendee, qrDataUrl, frontElement);
  const frontImgData = frontCanvas.toDataURL('image/png');
  pdf.addImage(frontImgData, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');

  const outputName =
    fileName ||
    `Badge_${attendee.ticketCode}_${attendee.fullName.replace(/\s+/g, '_')}.pdf`;

  pdf.save(outputName);
  return pdf.output('blob');
}

/**
 * Generates a standalone, print-ready PDF for the common master Back Side (Scientific Programme):
 * 1 Page: 105 mm × 148 mm A6 Portrait at 300 DPI with sharp 90-degree corners.
 */
export async function generateMasterBackPdf(
  backElement?: HTMLElement,
  scientificProgrammeQr?: string
): Promise<Blob> {
  const widthMm = JASICON_BRAND.dimensions.widthMm;
  const heightMm = JASICON_BRAND.dimensions.heightMm;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true,
  });

  const backCanvas = await renderBadgeBackToCanvas(scientificProgrammeQr, backElement);
  const backImgData = backCanvas.toDataURL('image/png');
  pdf.addImage(backImgData, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');

  pdf.save('JASICON_2026_Master_Back_Scientific_Programme.pdf');
  return pdf.output('blob');
}

/**
 * Bulk PDF Generator:
 * Generates a combined multi-attendee PDF containing 1 page per attendee (Front Side) at 300 DPI.
 */
export async function generateBulkBadgesPdf(
  badgeItems: Array<{
    attendee: BadgeAttendeeData;
    frontElement?: HTMLElement;
    qrDataUrl?: string;
  }>,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const widthMm = JASICON_BRAND.dimensions.widthMm;
  const heightMm = JASICON_BRAND.dimensions.heightMm;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true,
  });

  for (let i = 0; i < badgeItems.length; i++) {
    const { attendee, frontElement, qrDataUrl } = badgeItems[i];
    if (i > 0) {
      pdf.addPage([widthMm, heightMm], 'portrait');
    }

    const frontCanvas = await renderBadgeFrontToCanvas(attendee, qrDataUrl, frontElement);
    const frontImg = frontCanvas.toDataURL('image/png');
    pdf.addImage(frontImg, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');

    if (onProgress) {
      onProgress(i + 1, badgeItems.length);
    }
  }

  return pdf.output('blob');
}

/**
 * Standalone Instant / On-Spot Registration Front Renderer (300 DPI Native, 1240 × 1748 px)
 * Renders authentic JASICON 2026 artwork with a clean, elegant writing area for marker handwriting
 * ('Dr. _____' and a blank second line, no category pill), dummy event access QR code, and ticket code placeholder.
 */
export async function renderInstantRegistrationFrontToCanvas(): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1748;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to obtain canvas 2D rendering context');

  // 1. Load Master Background Artwork (A6 Portrait 300 DPI, Sharp 90-degree Corners)
  const masterBase = await loadCanvasImage('/branding/master-front-card.png?v=12');
  ctx.drawImage(masterBase, 0, 0, 1240, 1748);

  // 2. Open Elegant Marker Handwriting Panel (spacious ivory card with delicate gold border)
  const boxX = 180;
  const boxY = 700;
  const boxW = 880;
  const boxH = 460;
  const boxRadius = 24;

  ctx.save();
  ctx.fillStyle = '#FAF8F3';
  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, boxRadius);
  ctx.fill();

  ctx.strokeStyle = '#C5A059';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, boxRadius);
  ctx.stroke();

  // Line 1: 'Dr.' and a long blank underline
  ctx.fillStyle = '#0F2C23';
  ctx.font = '800 44px "Times New Roman", Times, Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const line1Y = boxY + 140;
  ctx.fillText('Dr.', boxX + 45, line1Y);

  ctx.strokeStyle = '#C5A059';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(boxX + 130, line1Y + 15);
  ctx.lineTo(boxX + boxW - 45, line1Y + 15);
  ctx.stroke();

  // Line 2: Clean blank underline (no text label)
  const line2Y = boxY + 310;
  ctx.beginPath();
  ctx.moveTo(boxX + 45, line2Y + 15);
  ctx.lineTo(boxX + boxW - 45, line2Y + 15);
  ctx.stroke();
  ctx.restore();

  // 3. Dummy Event Access QR Code (slot: x: 247, y: 1290, 286x286)
  try {
    const dummyQrDataUrl = await QRCode.toDataURL(JASICON_BRAND.websiteUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: { dark: '#0F2C23', light: '#FFFFFF' },
    });
    const qrImg = await loadCanvasImage(dummyQrDataUrl);
    ctx.drawImage(qrImg, 247, 1290, 286, 286);
  } catch (err) {
    console.warn('Failed to generate dummy QR, falling back to static programme QR:', err);
    try {
      const fallbackQr = await loadCanvasImage('/branding/scientific-programme-qr.png');
      ctx.drawImage(fallbackQr, 247, 1290, 286, 286);
    } catch {}
  }

  // 4. Ticket Code Box (top: 82.38%, left: 53.55%, width: 25.65%, height: 3.80%)
  const ticketPillX = 664;
  const ticketPillY = 1440;
  const ticketPillW = 318;
  const ticketPillH = 66;

  ctx.save();
  ctx.fillStyle = '#18231E';
  ctx.font = '800 28px Consolas, Monaco, "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('JC-2026-SPOT', ticketPillX + ticketPillW / 2, ticketPillY + ticketPillH / 2);
  ctx.restore();

  return canvas;
}

/**
 * Standalone Instant / On-Spot Registration Badge PDF Generator
 * Outputs strictly 1 page: Front side (105 mm × 148 mm A6 Portrait) at 300 DPI for physical printing.
 */
export async function generateInstantRegistrationBadgePdf(): Promise<Blob> {
  const widthMm = JASICON_BRAND.dimensions.widthMm;
  const heightMm = JASICON_BRAND.dimensions.heightMm;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true,
  });

  // Strictly 1 Page: Instant Registration Front Badge
  const frontCanvas = await renderInstantRegistrationFrontToCanvas();
  const frontImg = frontCanvas.toDataURL('image/png');
  pdf.addImage(frontImg, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');

  pdf.save('JASICON_2026_Instant_Registration_Badge.pdf');
  return pdf.output('blob');
}

