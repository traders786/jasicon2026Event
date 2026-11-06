/**
 * Utility functions for JASICON 2026 Master Badge Generation
 */

/**
 * Generates clean, title-free initials for attendee badges when photos are missing or inaccessible.
 * 
 * Rules:
 * - Strips leading/trailing and repeated whitespace
 * - Removes professional prefixes (Dr., Prof., Mr., Mrs., Ms., Doctor, etc.)
 * - Extracts first letter of each remaining name token (up to 3 characters max)
 * - Returns uppercase without punctuation
 * - Returns 'NA' for blank/invalid names
 */
export function generateInitials(fullName: string | null | undefined): string {
  if (!fullName || typeof fullName !== 'string') {
    return 'NA';
  }

  // 1. Normalize spaces
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'NA';

  // 2. Strip professional prefixes/honorifics
  // Handles: Dr, Dr., Doctor, Prof, Prof., Professor, Mr, Mr., Mrs, Mrs., Ms, Ms., Shri, Smt, etc.
  const prefixRegex = /^(dr\.?|doctor|prof\.?|professor|mr\.?|mrs\.?|ms\.?|shri\.?|smt\.?|col\.?|brig\.?|maj\.?)\s+/i;
  let nameWithoutPrefix = trimmed;
  while (prefixRegex.test(nameWithoutPrefix)) {
    nameWithoutPrefix = nameWithoutPrefix.replace(prefixRegex, '').trim();
  }

  // 3. Clean any punctuation within initials like S. K. Verma -> S K Verma
  const cleanedName = nameWithoutPrefix.replace(/[.,\-_/\\#@!$%^&*()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanedName) return 'NA';

  const parts = cleanedName.split(' ').filter(Boolean);
  if (parts.length === 0) return 'NA';

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  // Multi-part names: up to 3 uppercase initials
  const initials = parts.map((p) => p.charAt(0).toUpperCase()).join('');
  return initials.slice(0, 3);
}

/**
 * Formats attendee name for display: ensures clean title casing or Dr. prefix if appropriate.
 */
export function formatAttendeeDisplayName(fullName: string | null | undefined): string {
  if (!fullName || typeof fullName !== 'string') return 'DELEGATE';
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  
  // If name doesn't start with Dr. or Prof., check if title should be preserved
  if (/^(dr\.?|prof\.?|mr\.?|mrs\.?|ms\.?)/i.test(trimmed)) {
    // Normalize "dr " -> "Dr. "
    return trimmed.replace(/^dr\.?\s+/i, 'Dr. ').replace(/^prof\.?\s+/i, 'Prof. ');
  }
  
  // By default, for medical conference badges, ensure Dr. prefix if not already present
  return `Dr. ${trimmed}`;
}

/**
 * Calculates controlled font-size based on name length to maintain a fixed text area
 * without overflowing or wrapping awkwardly.
 */
export function getFontSizeForName(name: string): { fontSize: string; lineHeight: string } {
  const len = name.length;
  if (len <= 16) {
    return { fontSize: '1.28rem', lineHeight: '1.2' };
  } else if (len <= 22) {
    return { fontSize: '1.12rem', lineHeight: '1.2' };
  } else if (len <= 28) {
    return { fontSize: '0.98rem', lineHeight: '1.15' };
  } else {
    return { fontSize: '0.86rem', lineHeight: '1.1' };
  }
}

/**
 * Validates whether an attendee photo URL is non-empty and well-formed.
 */
export function hasValidPhoto(photoUrl?: string | null): boolean {
  if (!photoUrl || typeof photoUrl !== 'string') return false;
  const p = photoUrl.trim();
  if (!p || p.toLowerCase() === 'na' || p.toLowerCase() === 'null' || p.toLowerCase() === 'undefined') {
    return false;
  }
  return p.startsWith('data:image') || p.startsWith('http://') || p.startsWith('https://') || p.startsWith('/');
}

