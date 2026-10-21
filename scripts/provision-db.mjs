import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
const envExamplePath = path.join(projectRoot, '.env.example');
const gitignorePath = path.join(projectRoot, '.gitignore');

// Discovered psql binary path on this host
const psqlBin = 'C:\\Program Files\\Odoo 20.0.20260924\\PostgreSQL\\bin\\psql.exe';

/**
 * Prompts user for password on process.stdin with hidden terminal input (TTY).
 * Guarantees terminal state restoration and event listener cleanup in all exit paths.
 * Preserves exact entered characters (never trims whitespace).
 */
function promptHiddenPassword(promptText) {
  return new Promise((resolve, reject) => {
    process.stdout.write(promptText);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw || false;
    let input = '';
    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      try {
        if (stdin.isTTY) {
          stdin.setRawMode(wasRaw);
        }
      } catch {
        // Suppress reset errors on stream closure
      }
      stdin.removeListener('data', onData);
      stdin.removeListener('error', onError);
      stdin.pause();
    };

    const onError = (err) => {
      cleanup();
      process.stdout.write('\n');
      reject(err);
    };

    const onData = (ch) => {
      try {
        const str = ch.toString('utf8');
        for (const char of str) {
          if (char === '\n' || char === '\r' || char === '\u0004') {
            cleanup();
            process.stdout.write('\n');
            resolve(input);
            return;
          } else if (char === '\u0003') { // Ctrl+C
            cleanup();
            process.stdout.write('\n[ABORTED] Operation cancelled by user.\n');
            process.exit(1);
          } else if (char === '\u0008' || char === '\x7f') { // Backspace
            if (input.length > 0) {
              input = input.slice(0, -1);
            }
          } else {
            input += char;
          }
        }
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    stdin.resume();
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
    stdin.on('error', onError);
  });
}

/**
 * Obtains administrator credentials safely handling both TTY and non-TTY environments.
 * Preserves exact password characters without silent trimming.
 */
async function getAdminPassword() {
  if (process.env.ADMIN_PGPASSWORD !== undefined) {
    if (process.env.ADMIN_PGPASSWORD === '') {
      throw new Error('ADMIN_PGPASSWORD environment variable is set but empty. An explicit password is required.');
    }
    return process.env.ADMIN_PGPASSWORD;
  }

  // Non-TTY stream (e.g. piped or automated runner): enforce timeout to avoid hanging indefinitely
  if (!process.stdin.isTTY) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        rl.close();
        reject(
          new Error(
            'Timeout waiting for administrator password on non-TTY stdin (15s elapsed).\n' +
            'In automated environments, provide ADMIN_PGPASSWORD via process environment.'
          )
        );
      }, 15000);

      const rl = readline.createInterface({ input: process.stdin });
      rl.once('line', (line) => {
        clearTimeout(timeout);
        rl.close();
        if (line === '') {
          reject(new Error('Received empty administrator password on non-TTY stdin.'));
        } else {
          resolve(line);
        }
      });
      rl.once('error', (err) => {
        clearTimeout(timeout);
        rl.close();
        reject(err);
      });
    });
  }

  // Interactive TTY terminal
  const entered = await promptHiddenPassword('Enter PostgreSQL administrator (openpg) password (input hidden): ');
  if (entered === '') {
    throw new Error('Administrator password cannot be empty! Aborting.');
  }
  return entered;
}

/**
 * Execute SQL via psql using standard input (stdin) only.
 * Validates all required arguments and prevents child processes from inheriting
 * sensitive environment variables.
 */
function runPsql(db, sql, user, password) {
  if (!db || typeof db !== 'string' || db.trim() === '') {
    throw new Error('runPsql validation error: database name is required.');
  }
  if (!sql || typeof sql !== 'string' || sql.trim() === '') {
    throw new Error('runPsql validation error: SQL statement is required.');
  }
  if (!user || typeof user !== 'string' || user.trim() === '') {
    throw new Error('runPsql validation error: database username is required.');
  }
  if (password === undefined || password === null || password === '') {
    throw new Error('runPsql validation error: database password is required.');
  }

  const args = [
    '-h', 'localhost',
    '-p', '5432',
    '-U', user,
    '-d', db,
    '-t', '-A',
    '-v', 'ON_ERROR_STOP=1',
  ];

  // Build clean child environment: explicitly scrub ADMIN_PGPASSWORD from inheritance
  const sanitizedEnv = { ...process.env };
  delete sanitizedEnv.ADMIN_PGPASSWORD;
  sanitizedEnv.PGPASSWORD = password;

  const result = spawnSync(psqlBin, args, {
    input: sql,
    encoding: 'utf8',
    env: sanitizedEnv,
  });

  if (result.error) {
    throw new Error(`Failed to spawn psql: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const errorDetails = result.stderr ? result.stderr.trim() : 'Unknown database error';
    throw new Error(`PostgreSQL error (exit code ${result.status}): ${errorDetails}`);
  }

  return result.stdout ? result.stdout.trim() : '';
}

/**
 * Strictly validates parsed ACL data structure against the exact security policy:
 * - Exactly 3 allowed SIDs: Current User, SYSTEM (S-1-5-18), BUILTIN\Administrators (S-1-5-32-544)
 * - Inheritance disabled (AreAccessRulesProtected === true)
 * - Every ACE has IsInherited === false
 * - Every ACE has AccessControlType === 'Allow' (no Deny rules)
 * - Every principal has exact FileSystemRights === 'FullControl'
 * - Zero duplicate or conflicting ACEs
 * - All 3 required principals must be present
 */
function validateAclStructure(aclData, filename = '.env') {
  if (!aclData || typeof aclData !== 'object') {
    throw new Error(`ACL validation failed: Malformed or missing ACL data structure for ${filename}.`);
  }

  if (typeof aclData.CurrentUserSid !== 'string' || !aclData.CurrentUserSid.startsWith('S-1-')) {
    throw new Error(`ACL validation failed: Invalid or missing CurrentUserSid for ${filename}.`);
  }

  if (aclData.AreAccessRulesProtected !== true) {
    throw new Error(`ACL validation failed: Inheritance is not disabled on ${filename}.`);
  }

  if (!Array.isArray(aclData.Entries)) {
    throw new Error(`ACL validation failed: Access entries list is missing or not an array for ${filename}.`);
  }

  const REQUIRED_SIDS = {
    [aclData.CurrentUserSid]: 'Current User',
    'S-1-5-18': 'NT AUTHORITY\\SYSTEM',
    'S-1-5-32-544': 'BUILTIN\\Administrators',
  };

  const seenSids = new Set();

  for (const entry of aclData.Entries) {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`ACL validation failed: Malformed entry object in ${filename}.`);
    }

    if (entry.IsInherited !== false) {
      throw new Error(`ACL validation failed: Inherited rule detected on ${filename} for ${entry.Identity} (${entry.Sid}).`);
    }

    if (entry.AccessControlType !== 'Allow') {
      throw new Error(
        `ACL validation failed: Non-allow rule detected on ${filename} for ${entry.Identity} (${entry.Sid}): AccessControlType=${entry.AccessControlType}`
      );
    }

    if (!REQUIRED_SIDS[entry.Sid]) {
      throw new Error(`ACL validation failed: Unexpected principal detected with access to ${filename}: ${entry.Identity} (${entry.Sid})`);
    }

    if (seenSids.has(entry.Sid)) {
      throw new Error(`ACL validation failed: Duplicate ACE detected on ${filename} for SID ${entry.Sid} (${entry.Identity}).`);
    }
    seenSids.add(entry.Sid);

    if (entry.FileSystemRights !== 'FullControl') {
      throw new Error(
        `ACL validation failed: Principal ${entry.Identity} (${REQUIRED_SIDS[entry.Sid]}) does not have exact FullControl on ${filename}. Actual rights: "${entry.FileSystemRights}"`
      );
    }
  }

  for (const [sid, name] of Object.entries(REQUIRED_SIDS)) {
    if (!seenSids.has(sid)) {
      throw new Error(`ACL validation failed: Missing required principal ${name} (SID: ${sid}) on ${filename}.`);
    }
  }

  return true;
}

/**
 * Configures and comprehensively verifies Windows NTFS ACL protection on .env.
 * Uses PowerShell's native FileSecurity API and canonical Security Identifiers (SIDs).
 */
function secureAndVerifyWindowsFileAcl(filePath) {
  if (process.platform !== 'win32') {
    return;
  }

  const psScript = `
    $ErrorActionPreference = 'Stop'
    $targetPath = '${filePath.replace(/'/g, "''")}'
    
    # 1. Configure ACL
    $acl = Get-Acl -LiteralPath $targetPath
    $acl.SetAccessRuleProtection($true, $false) # Disables inheritance, removes existing inherited rules
    
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $currentUserSid = $currentUser.User.Value
    
    # Grant Current User FullControl
    $userRule = [System.Security.AccessControl.FileSystemAccessRule]::new($currentUser.User, 'FullControl', 'Allow')
    $acl.AddAccessRule($userRule)
    
    # Grant SYSTEM FullControl (preserves Windows OS services and system backup agents)
    $systemSid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    $systemRule = [System.Security.AccessControl.FileSystemAccessRule]::new($systemSid, 'FullControl', 'Allow')
    $acl.AddAccessRule($systemRule)
    
    # Grant Administrators FullControl (preserves administrative maintenance)
    $adminSid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
    $adminRule = [System.Security.AccessControl.FileSystemAccessRule]::new($adminSid, 'FullControl', 'Allow')
    $acl.AddAccessRule($adminRule)
    
    Set-Acl -LiteralPath $targetPath -AclObject $acl
    
    # 2. Read back live ACL and serialize structured representation
    $verifiedAcl = Get-Acl -LiteralPath $targetPath
    $entries = @($verifiedAcl.Access) | ForEach-Object {
      $sidStr = try { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value } catch { $_.IdentityReference.Value }
      [PSCustomObject]@{
        Identity = $_.IdentityReference.Value
        Sid = $sidStr
        FileSystemRights = $_.FileSystemRights.ToString()
        AccessControlType = $_.AccessControlType.ToString()
        IsInherited = $_.IsInherited
      }
    }
    
    [PSCustomObject]@{
      CurrentUserSid = $currentUserSid
      CurrentUserName = $currentUser.Name
      AreAccessRulesProtected = $verifiedAcl.AreAccessRulesProtected
      Entries = $entries
    } | ConvertTo-Json -Compress -Depth 4
  `;

  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const err = result.stderr ? result.stderr.trim() : 'Unknown PowerShell ACL error';
    throw new Error(`NTFS ACL configuration/verification failed on .env: ${err}`);
  }

  let aclData;
  try {
    aclData = JSON.parse(result.stdout.trim());
  } catch (parseErr) {
    throw new Error(
      `Failed to parse structured ACL verification output for .env: ${parseErr.message}\n` +
      `Raw output:\n${result.stdout}`
    );
  }

  validateAclStructure(aclData, path.basename(filePath));

  console.log(`      Verified Windows NTFS ACL: inheritance disabled. Authorized principals strictly limited to:`);
  aclData.Entries.forEach((e) => console.log(`        ✓ ${e.Identity} [${e.Sid}]: ${e.FileSystemRights} (${e.AccessControlType})`));

  return {
    verified: true,
    currentUser: aclData.CurrentUserName,
    currentUserSid: aclData.CurrentUserSid,
    entries: aclData.Entries,
  };
}

async function main() {
  console.log('=== EventCheck Secure Database Provisioning ===\n');

  const completedSteps = [];
  let adminPassword = null;

  try {
    // -------------------------------------------------------------------------
    // PRE-FLIGHT SAFETY CHECKS (Zero database changes made during this phase)
    // -------------------------------------------------------------------------
    console.log('[Pre-flight 1/6] Obtaining administrator credentials...');
    adminPassword = await getAdminPassword();

    console.log('[Pre-flight 2/6] Checking .env existence...');
    if (fs.existsSync(envPath)) {
      throw new Error(
        'The .env file already exists! Aborting immediately to prevent overwriting existing configuration.'
      );
    }

    console.log('[Pre-flight 3/6] Checking .gitignore protection...');
    if (!fs.existsSync(gitignorePath)) {
      throw new Error('.gitignore not found! Aborting to prevent accidental secret commitment.');
    }
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignoreContent.includes('.env*') && !gitignoreContent.includes('.env')) {
      throw new Error('.gitignore does not exclude .env! Aborting for security.');
    }

    console.log('[Pre-flight 4/6] Verifying .env.example contains only placeholders...');
    if (!fs.existsSync(envExamplePath)) {
      throw new Error('.env.example template missing! Aborting.');
    }
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf8');
    if (!envExampleContent.includes('YOUR_SECURE_PASSWORD')) {
      throw new Error('.env.example appears to contain modified or non-placeholder credentials! Aborting.');
    }

    console.log('[Pre-flight 5/6] Checking if role "eventcheck_app" already exists...');
    const roleCheck = runPsql(
      'postgres',
      "SELECT count(*) FROM pg_roles WHERE rolname = 'eventcheck_app';",
      'openpg',
      adminPassword
    );
    if (roleCheck !== '0') {
      throw new Error(
        'Role "eventcheck_app" already exists in PostgreSQL! Aborting to prevent password collisions or unexpected role modification.'
      );
    }

    console.log('[Pre-flight 6/6] Checking if database "eventcheck_dev" already exists...');
    const dbCheck = runPsql(
      'postgres',
      "SELECT count(*) FROM pg_database WHERE datname = 'eventcheck_dev';",
      'openpg',
      adminPassword
    );
    if (dbCheck !== '0') {
      throw new Error(
        'Database "eventcheck_dev" already exists in PostgreSQL! Aborting to prevent unintended schema or permission modifications.'
      );
    }

    console.log('Pre-flight checks passed: Clean environment confirmed. Proceeding with provisioning.\n');

    // -------------------------------------------------------------------------
    // STEP 1: Generate High-Entropy Alphanumeric Password in Memory
    // -------------------------------------------------------------------------
    console.log('[Step 1/7] Generating CSPRNG high-entropy application credential...');
    // 48-character hexadecimal string: 192 bits of entropy, strictly [0-9a-f]
    const appPassword = crypto.randomBytes(24).toString('hex');
    completedSteps.push('Generated secure 192-bit CSPRNG application credential in memory');

    // -------------------------------------------------------------------------
    // STEP 2: Create Role eventcheck_app with LOGIN only (via stdin stream)
    // -------------------------------------------------------------------------
    console.log('[Step 2/7] Creating role "eventcheck_app" with LOGIN only...');
    // The SQL containing the password is sent exclusively over stdin pipe, NOT in process argv
    const createRoleSql = `CREATE ROLE eventcheck_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${appPassword}';`;
    runPsql('postgres', createRoleSql, 'openpg', adminPassword);
    completedSteps.push('Created PostgreSQL role "eventcheck_app" (LOGIN only)');

    // -------------------------------------------------------------------------
    // STEP 3: Verify Role Privileges (Strict Assertion)
    // -------------------------------------------------------------------------
    console.log('[Step 3/7] Verifying role privileges...');
    const rolePrivs = runPsql(
      'postgres',
      "SELECT rolsuper || '|' || rolcreaterole || '|' || rolcreatedb FROM pg_roles WHERE rolname = 'eventcheck_app';",
      'openpg',
      adminPassword
    );
    const [isSuper, canCreateRole, canCreateDb] = rolePrivs.split('|');
    if (isSuper !== 'f' || canCreateRole !== 'f' || canCreateDb !== 'f') {
      throw new Error(
        `Role privilege assertion failed! Expected f|f|f but got ${rolePrivs}. Aborting.`
      );
    }
    completedSteps.push('Verified role privileges (SUPERUSER=false, CREATEROLE=false, CREATEDB=false)');

    // -------------------------------------------------------------------------
    // STEP 4: Create Database eventcheck_dev Owned by eventcheck_app
    // -------------------------------------------------------------------------
    console.log('[Step 4/7] Creating database "eventcheck_dev" owned by "eventcheck_app"...');
    runPsql('postgres', 'CREATE DATABASE eventcheck_dev OWNER eventcheck_app;', 'openpg', adminPassword);
    completedSteps.push('Created database "eventcheck_dev"');

    // Verify ownership
    const ownerCheck = runPsql(
      'postgres',
      "SELECT pg_catalog.pg_get_userbyid(datdba) FROM pg_database WHERE datname = 'eventcheck_dev';",
      'openpg',
      adminPassword
    );
    if (ownerCheck !== 'eventcheck_app') {
      throw new Error(
        `Database owner assertion failed! Expected owner "eventcheck_app" but got "${ownerCheck}".`
      );
    }
    completedSteps.push('Verified database ownership belongs to "eventcheck_app"');

    // -------------------------------------------------------------------------
    // STEP 5: Grant Minimum Necessary Schema Permissions
    // -------------------------------------------------------------------------
    console.log('[Step 5/7] Granting minimum necessary schema permissions...');
    runPsql(
      'eventcheck_dev',
      `
      GRANT CONNECT ON DATABASE eventcheck_dev TO eventcheck_app;
      GRANT ALL ON SCHEMA public TO eventcheck_app;
      `,
      'openpg',
      adminPassword
    );
    completedSteps.push('Configured minimum necessary schema permissions on "eventcheck_dev"');

    // -------------------------------------------------------------------------
    // STEP 6: Verify Application Connection Using New Credentials
    // -------------------------------------------------------------------------
    console.log('[Step 6/7] Verifying application connection as "eventcheck_app"...');
    const authTest = runPsql(
      'eventcheck_dev',
      "SELECT current_user || '@' || current_database();",
      'eventcheck_app',
      appPassword
    );
    if (authTest !== 'eventcheck_app@eventcheck_dev') {
      throw new Error(
        `Connection verification failed! Expected "eventcheck_app@eventcheck_dev" but got "${authTest}".`
      );
    }
    completedSteps.push('Verified connection authenticated as "eventcheck_app@eventcheck_dev"');

    // -------------------------------------------------------------------------
    // STEP 7: Write and Secure .env File (Only After All Verifications Pass)
    // -------------------------------------------------------------------------
    console.log('[Step 7/7] Writing and securing private .env configuration...');
    if (fs.existsSync(envPath)) {
      throw new Error('Collision detected: .env appeared during execution. Aborting write.');
    }

    const sessionSecret = crypto.randomBytes(32).toString('hex');
    const envContent = [
      '# ==============================================================================',
      '# EventCheck - Local Private Environment',
      '# NEVER commit this file to source control.',
      '# ==============================================================================',
      '',
      `DATABASE_URL="postgresql://eventcheck_app:${appPassword}@localhost:5432/eventcheck_dev?schema=public"`,
      'NODE_ENV="development"',
      'NEXT_PUBLIC_APP_URL="http://localhost:3000"',
      `SESSION_SECRET="${sessionSecret}"`,
      'RATE_LIMIT_MAX_REQUESTS_PER_MINUTE="60"',
      'ENABLE_NOTIFICATIONS="false"',
      'WHATSAPP_PROVIDER_ENABLED="false"',
      'WHATSAPP_API_TOKEN=""',
      'WHATSAPP_PHONE_NUMBER_ID=""',
      '',
    ].join('\n');

    // Atomic write using flag 'wx'
    fs.writeFileSync(envPath, envContent, { flag: 'wx', mode: 0o600 });
    secureAndVerifyWindowsFileAcl(envPath);
    completedSteps.push('Wrote and verified private .env configuration with restricted NTFS ACL permissions');

    console.log('\n[SUCCESS] Phase 1 database provisioning completed cleanly.');
    console.log('All steps executed and verified:');
    completedSteps.forEach((s, idx) => console.log(`  ✓ ${idx + 1}. ${s}`));
  } catch (err) {
    console.error('\n[PROVISIONING HALTED]');
    console.error('Error detail:', err.message);

    console.log('\n[COMPLETED STEPS PRIOR TO HALT]:');
    if (completedSteps.length === 0) {
      console.log('  (None - error occurred during pre-flight checks before any database changes were made)');
    } else {
      completedSteps.forEach((s, idx) => console.log(`  ✓ ${idx + 1}. ${s}`));
    }

    // Inspect ACTUAL database state
    console.log('\n[ACTUAL SYSTEM STATE INSPECTION]:');
    let liveRoleState = 'UNKNOWN (not checked)';
    let liveDbState = 'UNKNOWN (not checked)';

    if (adminPassword) {
      try {
        const checkR = runPsql(
          'postgres',
          "SELECT count(*) FROM pg_roles WHERE rolname = 'eventcheck_app';",
          'openpg',
          adminPassword
        );
        liveRoleState = checkR === '1' ? 'EXISTS in PostgreSQL' : 'Does not exist';
      } catch (rErr) {
        liveRoleState = `UNKNOWN (query failed: ${rErr.message.split('\n')[0]})`;
      }

      try {
        const checkD = runPsql(
          'postgres',
          "SELECT count(*) FROM pg_database WHERE datname = 'eventcheck_dev';",
          'openpg',
          adminPassword
        );
        liveDbState = checkD === '1' ? 'EXISTS in PostgreSQL' : 'Does not exist';
      } catch (dErr) {
        liveDbState = `UNKNOWN (query failed: ${dErr.message.split('\n')[0]})`;
      }
    } else {
      liveRoleState = 'UNKNOWN (administrator credentials were not available)';
      liveDbState = 'UNKNOWN (administrator credentials were not available)';
    }

    const liveEnvFound = fs.existsSync(envPath);

    console.log(`  - Role "eventcheck_app": ${liveRoleState}`);
    console.log(`  - Database "eventcheck_dev": ${liveDbState}`);
    console.log(`  - File ".env": ${liveEnvFound ? 'EXISTS on disk' : 'Does not exist (Not written)'}`);

    console.log('\n[SAFE RECOVERY INSTRUCTIONS]:');
    console.log('  1. No existing databases or roles were dropped or overwritten.');
    console.log('  2. No automated destructive operations have been run.');
    if (liveRoleState === 'Does not exist' && liveDbState === 'Does not exist' && !liveEnvFound) {
      console.log('  3. No changes were made to your system. Fix the issue above and re-run.');
    } else {
      console.log('  3. If you wish to reset the partial state cleanly before re-running:');
      if (liveDbState === 'EXISTS in PostgreSQL') console.log('       DROP DATABASE IF EXISTS eventcheck_dev;');
      if (liveRoleState === 'EXISTS in PostgreSQL') console.log('       DROP ROLE IF EXISTS eventcheck_app;');
      if (liveEnvFound) console.log('       Remove-Item .env');
    }

    process.exit(1);
  }
}
export { validateAclStructure, secureAndVerifyWindowsFileAcl };

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main();
}
