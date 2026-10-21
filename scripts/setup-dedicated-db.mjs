import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const pgDataDir = path.join(projectRoot, '.pgdata');
const envPath = path.join(projectRoot, '.env');
const gitignorePath = path.join(projectRoot, '.gitignore');

const pgBinDir = 'C:\\Program Files\\Odoo 20.0.20260924\\PostgreSQL\\bin';
const initdbBin = path.join(pgBinDir, 'initdb.exe');
const pgCtlBin = path.join(pgBinDir, 'pg_ctl.exe');
const psqlBin = path.join(pgBinDir, 'psql.exe');

function runCommand(bin, args, options = {}) {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    ...options,
  });
  if (result.error) {
    throw new Error(`Failed to execute ${path.basename(bin)}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const err = result.stderr ? result.stderr.trim() : `Exited with status ${result.status}`;
    throw new Error(`${path.basename(bin)} failed: ${err}`);
  }
  return result.stdout ? result.stdout.trim() : '';
}

function runPsql(db, sql, user, password, port = '5433') {
  const env = { ...process.env, PGPASSWORD: password };
  const result = spawnSync(
    psqlBin,
    ['-h', '127.0.0.1', '-p', port, '-U', user, '-d', db, '-t', '-A', '-v', 'ON_ERROR_STOP=1'],
    {
      input: sql,
      env,
      encoding: 'utf8',
    }
  );
  if (result.error) {
    throw new Error(`Failed to spawn psql: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const err = result.stderr ? result.stderr.trim() : `Exit code ${result.status}`;
    throw new Error(`psql error: ${err}`);
  }
  return result.stdout ? result.stdout.trim() : '';
}

function secureAndVerifyWindowsFileAcl(filePath) {
  if (process.platform !== 'win32') return;

  const psScript = `
    $ErrorActionPreference = 'Stop'
    $targetPath = '${filePath.replace(/'/g, "''")}'
    $acl = Get-Acl -LiteralPath $targetPath
    $acl.SetAccessRuleProtection($true, $false)
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $userRule = [System.Security.AccessControl.FileSystemAccessRule]::new($currentUser.User, 'FullControl', 'Allow')
    $acl.AddAccessRule($userRule)
    $systemSid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    $systemRule = [System.Security.AccessControl.FileSystemAccessRule]::new($systemSid, 'FullControl', 'Allow')
    $acl.AddAccessRule($systemRule)
    $adminSid = [System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-544')
    $adminRule = [System.Security.AccessControl.FileSystemAccessRule]::new($adminSid, 'FullControl', 'Allow')
    $acl.AddAccessRule($adminRule)
    Set-Acl -LiteralPath $targetPath -AclObject $acl
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
      CurrentUserSid = $currentUser.User.Value
      CurrentUserName = $currentUser.Name
      AreAccessRulesProtected = $verifiedAcl.AreAccessRulesProtected
      Entries = $entries
    } | ConvertTo-Json -Compress -Depth 4
  `;

  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`PowerShell ACL configuration failed: ${result.stderr ? result.stderr.trim() : 'Unknown error'}`);
  }
}

async function main() {
  console.log('=== EventCheck Dedicated PostgreSQL Database Setup (Port 5433) ===\n');

  // Step 1: Ensure .env does not already exist
  if (fs.existsSync(envPath)) {
    throw new Error('.env file already exists! Aborting to prevent overwriting.');
  }

  // Step 2: Initialize dedicated cluster if not already present
  const adminPassword = crypto.randomBytes(24).toString('hex');
  const tempPwFile = path.join(projectRoot, '.initdb_pw_tmp');

  if (!fs.existsSync(pgDataDir)) {
    console.log('[1/7] Initializing dedicated PostgreSQL cluster at .pgdata...');
    fs.writeFileSync(tempPwFile, adminPassword, { encoding: 'utf8', mode: 0o600 });

    try {
      runCommand(initdbBin, [
        '-D', pgDataDir,
        '-U', 'eventcheck_admin',
        '-A', 'scram-sha-256',
        `--pwfile=${tempPwFile}`,
        '-E', 'UTF8',
        '--locale=C',
        '--no-instructions',
      ]);
    } finally {
      if (fs.existsSync(tempPwFile)) {
        fs.unlinkSync(tempPwFile);
      }
    }

    // Configure port 5433 and 127.0.0.1 in postgresql.conf
    const confPath = path.join(pgDataDir, 'postgresql.conf');
    let confContent = fs.readFileSync(confPath, 'utf8');
    confContent += '\n# EventCheck dedicated port and host\nport = 5433\nlisten_addresses = \'127.0.0.1\'\n';
    fs.writeFileSync(confPath, confContent, 'utf8');
    console.log('      Cluster initialized and configured on port 5433.');
  } else {
    console.log('[1/7] Existing .pgdata cluster directory found.');
  }

  // Step 3: Start the cluster via pg_ctl
  console.log('[2/7] Starting dedicated PostgreSQL server on port 5433...');
  const serverLog = path.join(pgDataDir, 'server.log');
  
  // Check if server is already running
  const statusRes = spawnSync(pgCtlBin, ['status', '-D', pgDataDir], { encoding: 'utf8' });
  if (statusRes.status !== 0) {
    const startRes = spawnSync(
      pgCtlBin,
      ['start', '-D', pgDataDir, '-l', serverLog, '-w'],
      { stdio: 'ignore', windowsHide: true }
    );
    if (startRes.error) {
      throw new Error(`Failed to start dedicated PostgreSQL: ${startRes.error.message}`);
    }
  }
  
  // Verify status
  const checkStatus = spawnSync(pgCtlBin, ['status', '-D', pgDataDir], { encoding: 'utf8' });
  if (checkStatus.status !== 0 || !checkStatus.stdout.includes('server is running')) {
    throw new Error(`Dedicated PostgreSQL failed to start. Check log at ${serverLog}`);
  }
  console.log('      Server is running on port 5433.');

  // Step 4: Provision application role and database
  console.log('[3/7] Generating application credentials...');
  const appPassword = crypto.randomBytes(24).toString('hex');

  console.log('[4/7] Creating application role "eventcheck_app" and database "eventcheck_dev"...');
  runPsql(
    'postgres',
    `CREATE ROLE eventcheck_app WITH LOGIN NOSUPERUSER CREATEDB NOCREATEROLE PASSWORD '${appPassword}';`,
    'eventcheck_admin',
    adminPassword
  );

  runPsql(
    'postgres',
    'CREATE DATABASE eventcheck_dev OWNER eventcheck_app;',
    'eventcheck_admin',
    adminPassword
  );

  runPsql(
    'eventcheck_dev',
    `
    GRANT CONNECT ON DATABASE eventcheck_dev TO eventcheck_app;
    GRANT ALL ON SCHEMA public TO eventcheck_app;
    `,
    'eventcheck_admin',
    adminPassword
  );
  console.log('      Role "eventcheck_app" and database "eventcheck_dev" created.');

  // Step 5: Verify connection as eventcheck_app
  console.log('[5/7] Verifying application connection as "eventcheck_app"...');
  const verifyResult = runPsql(
    'eventcheck_dev',
    "SELECT current_user || '@' || current_database();",
    'eventcheck_app',
    appPassword
  );
  if (verifyResult !== 'eventcheck_app@eventcheck_dev') {
    throw new Error(`Connection verification failed! Got "${verifyResult}"`);
  }
  console.log(`      Verified connection: ${verifyResult}`);

  // Step 6: Create .env exclusively and secure ACL
  console.log('[6/7] Creating .env with secure configuration...');
  const sessionSecret = crypto.randomBytes(32).toString('hex');
  const envContent = [
    '# ============================================================================== #',
    '# EventCheck - Local Development Environment Configuration                         #',
    '# ============================================================================== #',
    `DATABASE_URL="postgresql://eventcheck_app:${appPassword}@127.0.0.1:5433/eventcheck_dev?schema=public"`,
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

  fs.writeFileSync(envPath, envContent, { flag: 'wx', encoding: 'utf8' });
  secureAndVerifyWindowsFileAcl(envPath);
  console.log('      .env created and secured with Windows NTFS ACL.');

  // Step 7: Update .gitignore to exclude .pgdata
  console.log('[7/7] Ensuring .pgdata is in .gitignore...');
  let gitignore = fs.readFileSync(gitignorePath, 'utf8');
  if (!gitignore.includes('.pgdata')) {
    gitignore += '\n# Local dedicated PostgreSQL data directory\n/.pgdata/\n';
    fs.writeFileSync(gitignorePath, gitignore, 'utf8');
    console.log('      Added /.pgdata/ to .gitignore.');
  }

  console.log('\n=== Dedicated Database Setup Complete! ===');
  console.log('Database URL: postgresql://eventcheck_app:******@127.0.0.1:5433/eventcheck_dev');
  console.log('PostgreSQL 5432 (Odoo) remained 100% untouched.\n');
}

main().catch((err) => {
  console.error('\n[FATAL ERROR]:', err.message);
  process.exit(1);
});
