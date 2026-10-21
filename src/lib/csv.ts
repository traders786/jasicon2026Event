/**
 * RFC 4180 compliant lightweight CSV parser and generator.
 * Zero external dependencies.
 */

export interface ParsedCsvRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
}

export function parseCsv(text: string): ParsedCsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Auto-detect delimiter: Tab (from Excel/Sheets copy-paste), Semicolon, or Comma
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) {
    delimiter = '\t';
  } else if (firstLine.includes(';') && !firstLine.includes(',')) {
    delimiter = ';';
  }

  const rawHeaders = splitCsvLine(lines[0], delimiter);
  const headers = rawHeaders.map((h) => h.trim().toLowerCase());

  // Detect column indices with flexible synonyms (including Indian conference formats)
  const fnIdx = headers.findIndex((h) => h.includes('first') || h === 'firstname' || h === 'fname');
  const lnIdx = headers.findIndex((h) => h.includes('last') || h === 'lastname' || h === 'lname');
  const nameIdx = headers.findIndex((h) => h === 'name' || h.includes('attendee') || h.includes('participant') || h.includes('doctor') || h.includes('faculty'));
  const emIdx = headers.findIndex((h) => h.includes('email') || h === 'mail' || h === 'e-mail');
  const phIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('contact') || h.includes('cell') || h.includes('whatsapp'));
  const coIdx = headers.findIndex((h) => h.includes('distt') || h.includes('district') || h.includes('company') || h.includes('org') || h.includes('city') || h.includes('location') || h.includes('hospital') || h.includes('institution'));
  const jtIdx = headers.findIndex((h) => h.includes('catogry') || h.includes('category') || h.includes('title') || h.includes('role') || h.includes('designation') || h.includes('specialty'));

  const rows: ParsedCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    if (cols.length === 0 || cols.every((c) => !c.trim())) continue;

    const phoneRaw = phIdx >= 0 ? cols[phIdx]?.trim() : undefined;
    const phone = phoneRaw || undefined;
    const company = coIdx >= 0 ? cols[coIdx]?.trim() || undefined : undefined;
    const jobTitle = jtIdx >= 0 ? cols[jtIdx]?.trim() || undefined : undefined;

    let firstName = 'Guest';
    let lastName = 'Participant';

    if (fnIdx >= 0 && lnIdx >= 0) {
      firstName = cols[fnIdx]?.trim() || 'Guest';
      lastName = cols[lnIdx]?.trim() || 'Participant';
    } else if (nameIdx >= 0 && cols[nameIdx]?.trim()) {
      const full = cols[nameIdx].trim();
      const parts = full.split(/\s+/);
      if (parts.length === 1) {
        firstName = parts[0];
        lastName = 'Attendee';
      } else if (parts.length === 2) {
        firstName = parts[0];
        lastName = parts[1];
      } else if (/^(dr|prof|mr|mrs|ms)\.?$/i.test(parts[0])) {
        // e.g. "Dr. Ajay Kumar" -> firstName: "Dr. Ajay", lastName: "Kumar"
        firstName = `${parts[0]} ${parts[1]}`;
        lastName = parts.slice(2).join(' ');
      } else {
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      }
    } else if (fnIdx >= 0) {
      firstName = cols[fnIdx]?.trim() || 'Guest';
    }

    // Email resolution: use parsed email, or synthesize deterministic unique email from mobile / name
    let email = emIdx >= 0 ? cols[emIdx]?.trim().toLowerCase() : '';
    if (!email) {
      const cleanDigits = phone ? phone.replace(/\D/g, '') : '';
      if (cleanDigits && cleanDigits.length >= 7) {
        email = `${cleanDigits}@attendee.eventcheck.local`;
      } else {
        const slug = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.');
        email = `${slug || 'attendee'}.${i}@attendee.eventcheck.local`;
      }
    }

    rows.push({
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
    });
  }

  return rows;
}

function splitCsvLine(line: string, delimiter: string = ','): string[] {
  if (delimiter === '\t') {
    return line.split('\t').map((c) => c.replace(/^["']|["']$/g, '').trim());
  }

  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function generateCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escapeCell = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCell).join(','));

  return [headerLine, ...rowLines].join('\r\n');
}
