import * as XLSX from 'xlsx';

export interface ColumnMapping {
  registrationNoIdx: number;
  nameIdx: number;
  firstNameIdx: number;
  lastNameIdx: number;
  emailIdx: number;
  phoneIdx: number;
  categoryIdx: number;
  districtIdx: number;
  dateIdx: number;
}

export interface ParsedParticipant {
  rowNumber: number;
  registrationNo?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  company?: string; // District / Location / Organization
  jobTitle?: string; // Category / Designation / Role
  registrationDate?: string;
  isSynthesizedEmail: boolean;
}

export interface SpreadsheetParseResult {
  sheetNames: string[];
  selectedSheet: string;
  headerRowIndex: number;
  headers: string[];
  columnMapping: Partial<Record<keyof ColumnMapping, string>>;
  participants: ParsedParticipant[];
  invalidRows: Array<{ rowNumber: number; reason: string; raw: unknown }>;
  totalRowsProcessed: number;
}

/**
 * Normalizes header strings for flexible matching.
 */
function normalizeHeader(h: unknown): string {
  if (h === null || h === undefined) return '';
  return String(h).trim().toLowerCase().replace(/[\r\n\t_]+/g, ' ');
}

/**
 * Sanitizes cell text against formula injection (starts with =, +, -, @)
 */
export function sanitizeCellValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Strip formula prefixes if followed by an expression
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  return str;
}

/**
 * Formats Excel dates or text date strings to clean readable format.
 */
export function formatSpreadsheetDate(val: unknown): string | undefined {
  if (val === null || val === undefined || val === '') return undefined;

  // Handle Excel Date serial numbers (e.g. 45578)
  if (typeof val === 'number') {
    try {
      const dateObj = XLSX.SSF.parse_date_code(val);
      if (dateObj) {
        const y = dateObj.y;
        const m = String(dateObj.m).padStart(2, '0');
        const d = String(dateObj.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {
      // Fallback
    }
  }

  // Handle JavaScript Date objects
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }

  const str = String(val).trim();
  return str || undefined;
}

/**
 * Cleans phone number strings to valid digits while preserving international prefixes.
 */
export function formatPhoneNumber(val: unknown): string | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  let str = String(val).trim();
  // If scientific notation e.g. 9.007731038E9
  if (/^[0-9.]+[eE]\+?[0-9]+$/.test(str)) {
    try {
      str = BigInt(Math.round(Number(str))).toString();
    } catch {
      // Keep as-is
    }
  }
  // Strip trailing .0 from Excel float representations
  str = str.replace(/\.0+$/, '');
  const cleanDigits = str.replace(/[^0-9+]/g, '');
  return cleanDigits || str;
}

/**
 * Intelligent Header Row Detection:
 * Scans up to 15 rows looking for candidate table headers.
 */
/**
 * Determines whether a column header represents an attendee full name.
 */
function isNameHeader(h: string): boolean {
  if (!h) return false;
  // Exclude non-person name headers
  if (h.includes('company') || h.includes('hospital') || h.includes('org') || h.includes('file') || h.includes('sheet') || h.includes('event')) {
    return false;
  }
  // Exclude dedicated first/last name
  if (h.includes('first name') || h === 'firstname' || h === 'fname' || h.includes('last name') || h === 'lastname' || h === 'lname' || h === 'surname') {
    return false;
  }
  return (
    h === 'name' ||
    h.includes('full name') ||
    h.includes('fullname') ||
    h.includes('attendee') ||
    h.includes('participant') ||
    h.includes('delegate') ||
    h.includes('doctor') ||
    h.includes('dr.') ||
    h.includes('person') ||
    h.includes('member') ||
    h.includes('candidate') ||
    h.endsWith(' name') ||
    h.startsWith('name of')
  );
}

export function detectHeaderRow(rows: unknown[][]): { headerRowIndex: number; score: number } {
  let bestIdx = 0;
  let bestScore = -1;

  const maxScan = Math.min(15, rows.length);
  for (let r = 0; r < maxScan; r++) {
    const rawRow = rows[r];
    if (!Array.isArray(rawRow) || rawRow.length === 0) continue;

    const cells = rawRow.map(normalizeHeader);
    let score = 0;

    // High confidence keywords
    if (cells.some(isNameHeader)) {
      score += 4;
    }
    if (cells.some((c) => c.includes('first name') || c === 'firstname' || c === 'fname')) {
      score += 3;
    }
    if (cells.some((c) => c.includes('last name') || c === 'lastname' || c === 'lname' || c === 'surname')) {
      score += 3;
    }
    if (cells.some((c) => c.includes('mobile') || c.includes('phone') || c.includes('contact') || c.includes('cell') || c.includes('whatsapp'))) {
      score += 3;
    }
    if (cells.some((c) => c.includes('email') || c.includes('e-mail') || c === 'mail')) {
      score += 3;
    }
    if (cells.some((c) => c.includes('sl no') || c === 'sl.no' || c === 'sl. no.' || c.includes('serial') || c.includes('reg no') || c.includes('registration no') || c === 'id' || c === '#')) {
      score += 2;
    }
    if (cells.some((c) => c.includes('catogry') || c.includes('category') || c.includes('designation') || c.includes('role') || c.includes('specialty') || c.includes('profession'))) {
      score += 2;
    }
    if (cells.some((c) => c.includes('distt') || c.includes('district') || c.includes('city') || c.includes('company') || c.includes('organization') || c.includes('hospital') || c.includes('institution') || c.includes('location'))) {
      score += 2;
    }
    if (cells.some((c) => c.includes('date of registration') || c.includes('reg date') || c.includes('registration date'))) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIdx = r;
    }
  }

  // If score is high enough, return detected index, otherwise fallback to 0
  return { headerRowIndex: bestScore >= 3 ? bestIdx : 0, score: bestScore };
}

/**
 * Discovers the best sheet in a multi-sheet workbook.
 */
export function findBestSheet(workbook: XLSX.WorkBook): string {
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 1) return sheetNames[0];

  let bestSheet = sheetNames[0];
  let highestScore = -1;

  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    const { score } = detectHeaderRow(rawRows);
    if (score > highestScore) {
      highestScore = score;
      bestSheet = name;
    }
  }

  return bestSheet;
}

/**
 * Parses and splits full names into first and last name components cleanly.
 */
export function splitFullName(rawName: string): { firstName: string; lastName: string } {
  const trimmed = rawName.trim();
  if (!trimmed) return { firstName: '', lastName: '' };

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  // Recognize common professional prefixes
  if (/^(dr|prof|mr|mrs|ms|col|brig|capt|rev)\.?$/i.test(parts[0])) {
    if (parts.length === 2) {
      return { firstName: parts[0], lastName: parts[1] };
    }
    return {
      firstName: `${parts[0]} ${parts[1]}`,
      lastName: parts.slice(2).join(' '),
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Universal spreadsheet parser accepting Buffer (.xlsx, .xls, .csv) or text.
 */
export function parseSpreadsheet(
  input: Buffer | string,
  options: { sheetName?: string; maxRows?: number } = {}
): SpreadsheetParseResult {
  const maxRows = options.maxRows ?? 5000;

  // 1. Read workbook safely without formula evaluation
  let workbook: XLSX.WorkBook;
  if (typeof input === 'string') {
    // Determine delimiter
    const firstFew = input.slice(0, 1000);
    const isTsv = firstFew.includes('\t') && !firstFew.includes(',');
    workbook = XLSX.read(input, {
      type: 'string',
      raw: false,
      cellFormula: false,
      cellHTML: false,
      FS: isTsv ? '\t' : undefined,
    });
  } else {
    workbook = XLSX.read(input, {
      type: 'buffer',
      raw: false,
      cellFormula: false,
      cellHTML: false,
    });
  }

  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 0) {
    throw new Error('Spreadsheet contains no readable worksheets.');
  }

  const selectedSheet = options.sheetName && sheetNames.includes(options.sheetName)
    ? options.sheetName
    : findBestSheet(workbook);

  const worksheet = workbook.Sheets[selectedSheet];
  if (!worksheet) {
    throw new Error(`Worksheet "${selectedSheet}" not found.`);
  }

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    blankrows: false,
    raw: false,
  });

  if (rawRows.length === 0) {
    return {
      sheetNames,
      selectedSheet,
      headerRowIndex: 0,
      headers: [],
      columnMapping: {},
      participants: [],
      invalidRows: [],
      totalRowsProcessed: 0,
    };
  }

  // 2. Detect real header row
  const { headerRowIndex } = detectHeaderRow(rawRows);
  const rawHeaderRow = (rawRows[headerRowIndex] || []) as unknown[];
  const headers = rawHeaderRow.map(normalizeHeader);

  // 3. Map column indices
  const mapping: ColumnMapping = {
    registrationNoIdx: headers.findIndex((h) =>
      h.includes('sl no') || h === 'sl.no' || h === 'sl. no.' || h === 's.no' || h.includes('serial') || h.includes('reg no') || h.includes('registration no') || h === 'id' || h === '#'
    ),
    nameIdx: headers.findIndex(isNameHeader),
    firstNameIdx: headers.findIndex((h) =>
      h.includes('first name') || h === 'firstname' || h === 'fname'
    ),
    lastNameIdx: headers.findIndex((h) =>
      h.includes('last name') || h === 'lastname' || h === 'lname' || h === 'surname'
    ),
    emailIdx: headers.findIndex((h) =>
      h.includes('email') || h.includes('e-mail') || h === 'mail'
    ),
    phoneIdx: headers.findIndex((h) =>
      h.includes('mobile') || h.includes('phone') || h.includes('contact') || h.includes('cell') || h.includes('whatsapp') || h.includes('tel')
    ),
    categoryIdx: headers.findIndex((h) =>
      h.includes('catogry') || h.includes('category') || h.includes('designation') || h.includes('role') || h.includes('specialty') || h.includes('title')
    ),
    districtIdx: headers.findIndex((h) =>
      h.includes('distt') || h.includes('district') || h.includes('city') || h.includes('company') || h.includes('organization') || h.includes('hospital') || h.includes('institution') || h.includes('location')
    ),
    dateIdx: headers.findIndex((h) =>
      h.includes('date of registration') || h.includes('reg date') || h.includes('registration date') || h === 'date'
    ),
  };

  const humanMapping: Partial<Record<keyof ColumnMapping, string>> = {};
  if (mapping.registrationNoIdx >= 0) humanMapping.registrationNoIdx = String(rawHeaderRow[mapping.registrationNoIdx]);
  if (mapping.nameIdx >= 0) humanMapping.nameIdx = String(rawHeaderRow[mapping.nameIdx]);
  if (mapping.firstNameIdx >= 0) humanMapping.firstNameIdx = String(rawHeaderRow[mapping.firstNameIdx]);
  if (mapping.lastNameIdx >= 0) humanMapping.lastNameIdx = String(rawHeaderRow[mapping.lastNameIdx]);
  if (mapping.emailIdx >= 0) humanMapping.emailIdx = String(rawHeaderRow[mapping.emailIdx]);
  if (mapping.phoneIdx >= 0) humanMapping.phoneIdx = String(rawHeaderRow[mapping.phoneIdx]);
  if (mapping.categoryIdx >= 0) humanMapping.categoryIdx = String(rawHeaderRow[mapping.categoryIdx]);
  if (mapping.districtIdx >= 0) humanMapping.districtIdx = String(rawHeaderRow[mapping.districtIdx]);
  if (mapping.dateIdx >= 0) humanMapping.dateIdx = String(rawHeaderRow[mapping.dateIdx]);

  // 4. Parse data rows
  const participants: ParsedParticipant[] = [];
  const invalidRows: Array<{ rowNumber: number; reason: string; raw: unknown }> = [];

  const startRow = headerRowIndex + 1;
  const endRow = Math.min(rawRows.length, startRow + maxRows);

  for (let r = startRow; r < endRow; r++) {
    const row = (rawRows[r] || []) as unknown[];
    if (row.length === 0 || row.every((c) => c === null || c === undefined || String(c).trim() === '')) {
      continue; // Skip blank rows
    }

    const regNo = mapping.registrationNoIdx >= 0 ? sanitizeCellValue(row[mapping.registrationNoIdx]) : undefined;
    const phone = mapping.phoneIdx >= 0 ? formatPhoneNumber(row[mapping.phoneIdx]) : undefined;
    const company = mapping.districtIdx >= 0 ? sanitizeCellValue(row[mapping.districtIdx]) || undefined : undefined;
    const category = mapping.categoryIdx >= 0 ? sanitizeCellValue(row[mapping.categoryIdx]) || undefined : undefined;
    const regDate = mapping.dateIdx >= 0 ? formatSpreadsheetDate(row[mapping.dateIdx]) : undefined;

    let fullName = '';
    let firstName = '';
    let lastName = '';

    if (mapping.nameIdx >= 0) {
      fullName = sanitizeCellValue(row[mapping.nameIdx]);
      if (!fullName) {
        invalidRows.push({
          rowNumber: r + 1,
          reason: 'Row has blank or missing attendee name.',
          raw: row,
        });
        continue;
      }
      const split = splitFullName(fullName);
      firstName = split.firstName;
      lastName = split.lastName;
    } else if (mapping.firstNameIdx >= 0) {
      firstName = sanitizeCellValue(row[mapping.firstNameIdx]);
      lastName = mapping.lastNameIdx >= 0 ? sanitizeCellValue(row[mapping.lastNameIdx]) : '';
      fullName = `${firstName} ${lastName}`.trim();
      if (!fullName) {
        invalidRows.push({
          rowNumber: r + 1,
          reason: 'Row has blank or missing attendee name.',
          raw: row,
        });
        continue;
      }
    } else {
      invalidRows.push({
        rowNumber: r + 1,
        reason: 'Missing attendee name column.',
        raw: row,
      });
      continue;
    }

    if (!firstName && !lastName) {
      invalidRows.push({
        rowNumber: r + 1,
        reason: 'Row has blank name values.',
        raw: row,
      });
      continue;
    }

    // Format jobTitle with category and optional registration number
    let jobTitle = category;
    if (regNo) {
      jobTitle = category ? `${category} (Reg #${regNo})` : `Reg #${regNo}`;
    }

    // Email resolution: use parsed email, or synthesize deterministic valid email
    let email = mapping.emailIdx >= 0 ? String(row[mapping.emailIdx] || '').trim().toLowerCase() : '';
    let isSynthesizedEmail = false;

    if (!email || !email.includes('@')) {
      isSynthesizedEmail = true;
      if (phone && phone.replace(/\D/g, '').length >= 7) {
        email = `${phone.replace(/\D/g, '')}@attendee.eventcheck.local`;
      } else if (regNo) {
        email = `attendee.reg${regNo.replace(/[^a-zA-Z0-9]/g, '')}@attendee.eventcheck.local`;
      } else {
        const slug = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').slice(0, 30);
        email = `${slug || 'attendee'}.${r + 1}@attendee.eventcheck.local`;
      }
    }

    participants.push({
      rowNumber: r + 1,
      registrationNo: regNo || undefined,
      firstName,
      lastName,
      fullName,
      email,
      phone,
      company,
      jobTitle,
      registrationDate: regDate,
      isSynthesizedEmail,
    });
  }

  return {
    sheetNames,
    selectedSheet,
    headerRowIndex,
    headers: rawHeaderRow.map((c) => String(c || '').trim()),
    columnMapping: humanMapping,
    participants,
    invalidRows,
    totalRowsProcessed: participants.length + invalidRows.length,
  };
}

/**
 * Generates sample CSV or XLSX import templates.
 */
export function generateImportTemplate(format: 'csv' | 'xlsx'): { buffer: Buffer; mimeType: string; filename: string } {
  const headers = [
    'Registration No',
    'Full Name',
    'Category / Designation',
    'Mobile / Phone',
    'District / Organization',
    'Email Address',
  ];

  const exampleRows = [
    ['101', 'Dr. Priya Sharma', 'Faculty', '9876543210', 'Ranchi', 'priya.sharma@example.com'],
    ['102', 'Dr. Amitav Sen', 'PG Student', '9876543211', 'Deoghar', 'amitav.sen@example.com'],
    ['103', 'Dr. Rajesh Verma', 'Delegate', '9876543212', 'Dhanbad', ''],
  ];

  if (format === 'csv') {
    const csvContent = [
      headers.join(','),
      ...exampleRows.map((r) => r.map((c) => (c.includes(',') ? `"${c}"` : c)).join(',')),
    ].join('\r\n');

    // Add UTF-8 BOM so Excel opens CSV without character corruption
    const bomBuffer = Buffer.from([0xef, 0xbb, 0xbf]);
    const contentBuffer = Buffer.from(csvContent, 'utf-8');

    return {
      buffer: Buffer.concat([bomBuffer, contentBuffer]),
      mimeType: 'text/csv; charset=utf-8',
      filename: 'EventCheck_Attendee_Import_Template.csv',
    };
  }

  // XLSX format
  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...exampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set friendly column widths
  ws['!cols'] = [
    { wch: 16 }, // Registration No
    { wch: 25 }, // Full Name
    { wch: 24 }, // Category
    { wch: 18 }, // Mobile
    { wch: 24 }, // District
    { wch: 30 }, // Email
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Attendee Template');
  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return {
    buffer: xlsxBuffer as Buffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: 'EventCheck_Attendee_Import_Template.xlsx',
  };
}
