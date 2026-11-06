import JSZip from 'jszip';
import jsPDF from 'jspdf';
import { JASICON_BRAND, BadgeAttendeeData } from '@/components/jasicon-badge/badgeConstants';
import { renderBadgeFrontToCanvas, renderBadgeBackToCanvas } from '@/lib/badge-pdf-generator';

export interface ProgressCallback {
  (current: number, total: number, statusText: string): void;
}

/**
 * Renders an offscreen element or attendee data to a high-resolution 1-page front PDF blob (300 DPI, Canvas 2D)
 */
export async function renderOffscreenBadgePairToPdfBlob(
  frontEl: HTMLElement,
  _backEl?: HTMLElement,
  attendee?: BadgeAttendeeData
): Promise<Blob> {
  const widthMm = JASICON_BRAND.dimensions.widthMm;
  const heightMm = JASICON_BRAND.dimensions.heightMm;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true,
  });

  const targetAttendee: BadgeAttendeeData = attendee || {
    attendeeId: 'fallback',
    fullName: frontEl.querySelector('h2')?.textContent || 'DELEGATE',
    ticketCode: frontEl.querySelector('span:last-child')?.textContent || 'JC-2026-0000',
    category: frontEl.querySelector('span')?.textContent || 'DELEGATE',
  };

  const frontCanvas = await renderBadgeFrontToCanvas(targetAttendee, undefined, frontEl);
  const frontImg = frontCanvas.toDataURL('image/png');
  pdf.addImage(frontImg, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');

  return pdf.output('blob');
}

/**
 * Creates a combined multi-attendee print-ready PDF (1 page Front per attendee) using native Canvas 2D
 */
export async function createBulkPrintPdf(
  items: Array<{
    attendee: BadgeAttendeeData;
    frontEl: HTMLElement;
    backEl?: HTMLElement;
  }>,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const widthMm = JASICON_BRAND.dimensions.widthMm;
  const heightMm = JASICON_BRAND.dimensions.heightMm;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
    compress: true,
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (onProgress) {
      onProgress(
        i + 1,
        items.length,
        `Rendering badge ${i + 1} of ${items.length} (${item.attendee.ticketCode})`
      );
    }

    if (i > 0) {
      pdf.addPage([widthMm, heightMm], 'portrait');
    }

    const frontCanvas = await renderBadgeFrontToCanvas(item.attendee, undefined, item.frontEl);
    const frontImg = frontCanvas.toDataURL('image/png');
    pdf.addImage(frontImg, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
  }

  return pdf.output('blob');
}

/**
 * Creates a ZIP archive containing individual front-side PDFs for all selected attendees
 */
export async function createBulkBadgesZip(
  items: Array<{
    attendee: BadgeAttendeeData;
    frontEl: HTMLElement;
    backEl?: HTMLElement;
  }>,
  onProgress?: ProgressCallback
): Promise<Blob> {
  const widthMm = JASICON_BRAND.dimensions.widthMm;
  const heightMm = JASICON_BRAND.dimensions.heightMm;
  const zip = new JSZip();
  const folder = zip.folder('JASICON_2026_Badges');

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (onProgress) {
      onProgress(
        i + 1,
        items.length,
        `Packaging ${i + 1} of ${items.length}: ${item.attendee.ticketCode}`
      );
    }

    const pdfBlob = await renderOffscreenBadgePairToPdfBlob(item.frontEl, item.backEl, item.attendee);
    const safeName = `${item.attendee.ticketCode}_${item.attendee.fullName.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    folder?.file(safeName, pdfBlob);
  }

  // Also include the common master back side PDF in the ZIP for print-shop convenience
  if (items.length > 0) {
    try {
      const backCanvas = await renderBadgeBackToCanvas(undefined, items[0].backEl);
      const backPdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [widthMm, heightMm],
        compress: true,
      });
      backPdf.addImage(backCanvas.toDataURL('image/png'), 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
      folder?.file('JASICON_2026_Master_Back_Scientific_Programme.pdf', backPdf.output('blob'));
    } catch (e) {
      console.warn('Could not include master back in zip:', e);
    }
  }

  if (onProgress) {
    onProgress(items.length, items.length, 'Compressing ZIP archive...');
  }

  return zip.generateAsync({ type: 'blob' });
}
