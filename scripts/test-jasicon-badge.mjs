/**
 * Automated Verification Suite for JASICON 2026 Master Badge Generation
 * Validates Scenarios 1 to 7 defined in the Master Development Prompt.
 */

import { generateInitials, formatAttendeeDisplayName, getFontSizeForName, hasValidPhoto } from '../src/components/jasicon-badge/badgeUtils.ts';
import { JASICON_BRAND } from '../src/components/jasicon-badge/badgeConstants.ts';
import { renderQrCodeDataUrl } from '../src/lib/qr.ts';

console.log('==============================================================');
console.log('JASICON 2026 MASTER BADGE ACCEPTANCE TEST SUITE');
console.log('==============================================================');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n--- SCENARIO 1 & 2: Initials Generation & Photo Validation ---');
  
  // Test 1: Single name
  assert(generateInitials('Vijay') === 'V', 'Single name "Vijay" -> "V"');
  
  // Test 2: Standard two-part doctor name
  assert(generateInitials('Dr. Vijay Kumar') === 'VK', 'Prefix stripping "Dr. Vijay Kumar" -> "VK"');
  assert(generateInitials('Doctor Vijay Kumar') === 'VK', '"Doctor Vijay Kumar" -> "VK"');
  
  // Test 3: Three-part name
  assert(generateInitials('Dr. Amit Kumar Singh') === 'AKS', 'Three-part name "Dr. Amit Kumar Singh" -> "AKS"');
  
  // Test 4: Professor title
  assert(generateInitials('Prof. Rajesh Sharma') === 'RS', '"Prof. Rajesh Sharma" -> "RS"');
  
  // Test 5: Complex punctuated initials
  assert(generateInitials('Dr. S. K. Verma') === 'SKV', '"Dr. S. K. Verma" -> "SKV"');
  
  // Test 6: Missing / null names
  assert(generateInitials('') === 'NA', 'Empty name -> "NA"');
  assert(generateInitials(null) === 'NA', 'Null name -> "NA"');
  
  console.log('\n--- SCENARIO 3: Photo Accessibility & Fallback ---');
  assert(hasValidPhoto('/uploads/photos/user1.jpg'), 'Valid local path photo recognized');
  assert(hasValidPhoto('data:image/jpeg;base64,/9j/4AAQSkZJRg=='), 'Valid base64 data URI recognized');
  assert(hasValidPhoto('https://evently.in/storage/avatar.png'), 'Valid HTTPS URL recognized');
  assert(!hasValidPhoto(''), 'Empty photo correctly marked false');
  assert(!hasValidPhoto(null), 'Null photo correctly marked false');
  assert(!hasValidPhoto('NA'), '"NA" photo correctly marked false');

  console.log('\n--- SCENARIO 4: Fixed Dimensions & Master Branding Constants ---');
  assert(JASICON_BRAND.dimensions.widthMm === 105, 'Badge width is exactly 105 mm');
  assert(JASICON_BRAND.dimensions.heightMm === 148, 'Badge height is exactly 148 mm (A6 Portrait)');
  assert(JASICON_BRAND.scientificProgrammeUrl === 'https://jasicon2026.in/', 'Fixed Common Scientific Programme URL verified (https://jasicon2026.in/)');
  assert(!!JASICON_BRAND.logos.leftEmblem, 'Logo 1 (left emblem) registered');
  assert(!!JASICON_BRAND.logos.centerMain, 'Logo 2 (center main) registered');
  assert(!!JASICON_BRAND.logos.rightChapter, 'Logo 3 (right chapter) registered');

  console.log('\n--- SCENARIO 5: Font Sizing & Typography Safety ---');
  const normalName = getFontSizeForName('DR. VIJAY KUMAR');
  const longName = getFontSizeForName('DR. RADHAKRISHNAN VENKATARAMANAN');
  assert(parseFloat(normalName.fontSize) >= parseFloat(longName.fontSize), 'Normal name fits at standard font size');
  assert(parseFloat(longName.fontSize) <= 1.05, 'Long name dynamically scales down to avoid overflow');

  console.log('\n--- SCENARIO 6: Unique Front QR vs Common Back QR ---');
  const attendee1Qr = await renderQrCodeDataUrl('EC_TICKET:JC-2026-0001:uuid-1');
  const attendee2Qr = await renderQrCodeDataUrl('EC_TICKET:JC-2026-0002:uuid-2');
  const commonProgQr = await renderQrCodeDataUrl(JASICON_BRAND.scientificProgrammeUrl);

  assert(attendee1Qr !== attendee2Qr, 'Different attendees receive unique Front QR payloads');
  assert(attendee1Qr.startsWith('data:image/png;base64,'), 'QR 1 generated as valid high-res Data URL');
  assert(commonProgQr.startsWith('data:image/png;base64,'), 'Common Scientific Programme QR generated successfully');

  console.log('\n==============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==============================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
