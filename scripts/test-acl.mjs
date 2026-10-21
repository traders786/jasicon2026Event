import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

import { validateAclStructure, secureAndVerifyWindowsFileAcl } from './provision-db.mjs';

// -----------------------------------------------------------------------------
// STANDALONE SUITE: Comprehensive Positive and Negative Verification Tests
// (Operates on a temporary scratch file; never touches .env or database)
// -----------------------------------------------------------------------------
async function runTests() {
  console.log('=== Running Isolated ACL Hardening & Verification Test Suite ===\n');

  const testFile = path.join(projectRoot, '.acl_hardening_test.tmp');
  let testCount = 0;
  let passCount = 0;

  function assertThrows(testName, fn, expectedSubstring) {
    testCount++;
    try {
      fn();
      console.error(`  FAIL [${testName}]: Expected error was not thrown!`);
    } catch (err) {
      if (err.message.includes(expectedSubstring)) {
        passCount++;
        console.log(`  PASS [${testName}]: Caught expected error ("${expectedSubstring}")`);
      } else {
        console.error(`  FAIL [${testName}]: Wrong error message: ${err.message}`);
      }
    }
  }

  try {
    // Test 1: Live end-to-end file configuration & strict validation
    testCount++;
    fs.writeFileSync(testFile, 'test payload');
    const liveResult = secureAndVerifyWindowsFileAcl(testFile);
    if (liveResult.verified && liveResult.entries.length === 3) {
      passCount++;
      console.log('  PASS [1. Live File ACL Hardening]: Correctly applied and verified 3 exact FullControl SIDs.');
    } else {
      console.error('  FAIL [1. Live File ACL Hardening]: Result was not properly verified.');
    }

    const validData = {
      CurrentUserSid: liveResult.currentUserSid,
      CurrentUserName: liveResult.currentUser,
      AreAccessRulesProtected: true,
      Entries: [
        { Identity: liveResult.currentUser, Sid: liveResult.currentUserSid, FileSystemRights: 'FullControl', AccessControlType: 'Allow', IsInherited: false },
        { Identity: 'NT AUTHORITY\\SYSTEM', Sid: 'S-1-5-18', FileSystemRights: 'FullControl', AccessControlType: 'Allow', IsInherited: false },
        { Identity: 'BUILTIN\\Administrators', Sid: 'S-1-5-32-544', FileSystemRights: 'FullControl', AccessControlType: 'Allow', IsInherited: false },
      ],
    };

    // Test 2: Reject unexpected principal
    assertThrows('2. Unexpected Principal', () => {
      validateAclStructure({
        ...validData,
        Entries: [
          ...validData.Entries,
          { Identity: 'BUILTIN\\Users', Sid: 'S-1-5-32-545', FileSystemRights: 'ReadAndExecute', AccessControlType: 'Allow', IsInherited: false },
        ],
      });
    }, 'Unexpected principal detected with access');

    // Test 3: Reject inherited rules
    assertThrows('3. Inherited Rule Detected', () => {
      validateAclStructure({
        ...validData,
        Entries: validData.Entries.map((e, idx) => idx === 0 ? { ...e, IsInherited: true } : e),
      });
    }, 'Inherited rule detected');

    // Test 4: Reject inheritance not disabled
    assertThrows('4. Inheritance Protection Disabled', () => {
      validateAclStructure({
        ...validData,
        AreAccessRulesProtected: false,
      });
    }, 'Inheritance is not disabled');

    // Test 5: Reject non-FullControl permissions (e.g. ReadAndExecute)
    assertThrows('5. Insufficient/Wrong Permissions', () => {
      validateAclStructure({
        ...validData,
        Entries: validData.Entries.map((e, idx) => idx === 0 ? { ...e, FileSystemRights: 'ReadAndExecute' } : e),
      });
    }, 'does not have exact FullControl');

    // Test 6: Reject conflicting Deny rules
    assertThrows('6. Conflicting Deny Rule', () => {
      validateAclStructure({
        ...validData,
        Entries: validData.Entries.map((e, idx) => idx === 1 ? { ...e, AccessControlType: 'Deny' } : e),
      });
    }, 'Non-allow rule detected');

    // Test 7: Reject duplicate ACEs
    assertThrows('7. Duplicate ACE', () => {
      validateAclStructure({
        ...validData,
        Entries: [...validData.Entries, { ...validData.Entries[0] }],
      });
    }, 'Duplicate ACE detected');

    // Test 8: Reject missing required principal
    assertThrows('8. Missing Required Principal (SYSTEM)', () => {
      validateAclStructure({
        ...validData,
        Entries: validData.Entries.filter((e) => e.Sid !== 'S-1-5-18'),
      });
    }, 'Missing required principal NT AUTHORITY\\SYSTEM');

    console.log(`\nTest Summary: ${passCount} of ${testCount} assertions passed cleanly.`);
  } finally {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
  }
}

runTests();
