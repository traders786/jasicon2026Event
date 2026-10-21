import crypto from 'node:crypto';
import QRCode from 'qrcode';

export interface GeneratedQrToken {
  plainToken: string; // Transmitted in QR payload only; NEVER stored in DB
  tokenHash: string;  // SHA-256 digest stored in EventRegistration.qrTokenHash
}

/**
 * Generates high-entropy bearer token for QR check-in badges.
 * ZERO PII: Contains no user names, emails, phones, or IDs.
 */
export function generateSecureQrToken(): GeneratedQrToken {
  // 32 cryptographically secure random bytes = 256 bits of entropy
  const randomHex = crypto.randomBytes(32).toString('hex');
  const plainToken = `ec_tok_${randomHex}`;
  const tokenHash = hashQrToken(plainToken);

  return { plainToken, tokenHash };
}

/**
 * Computes deterministic SHA-256 hash of a scanned or bearer token.
 */
export function hashQrToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Renders high-resolution QR code data URL for badge display and printing.
 */
export async function renderQrCodeDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H', // High error correction (30% damage recovery)
    margin: 2,
    width: 320,
    color: {
      dark: '#0f172a', // Deep slate for sharp barcode scanning
      light: '#ffffff',
    },
  });
}
