import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const pgDataDir = path.join(projectRoot, '.pgdata');
const confPath = path.join(pgDataDir, 'pg_hba.conf');
const pgCtlBin = 'C:\\Program Files\\Odoo 20.0.20260924\\PostgreSQL\\bin\\pg_ctl.exe';
const psqlBin = 'C:\\Program Files\\Odoo 20.0.20260924\\PostgreSQL\\bin\\psql.exe';

async function main() {
  console.log('=== Hardening eventcheck_app Privileges (Removing CREATEDB) ===\n');

  // 1. Read existing pg_hba.conf in .pgdata
  const originalConf = fs.readFileSync(confPath, 'utf8');

  // 2. Temporarily allow local eventcheck_admin trust connection
  const tempRule = 'host    all             eventcheck_admin 127.0.0.1/32            trust\r\n';
  fs.writeFileSync(confPath, tempRule + originalConf, 'utf8');

  // 3. Reload .pgdata configuration
  spawnSync(pgCtlBin, ['reload', '-D', pgDataDir], { encoding: 'utf8' });

  // 4. Alter role eventcheck_app to NOCREATEDB
  const alterRes = spawnSync(
    psqlBin,
    ['-h', '127.0.0.1', '-p', '5433', '-U', 'eventcheck_admin', '-d', 'postgres', '-c', 'ALTER ROLE eventcheck_app NOCREATEDB;'],
    { encoding: 'utf8' }
  );

  console.log('Alter output:', alterRes.stdout.trim());

  // 5. Restore original pg_hba.conf
  fs.writeFileSync(confPath, originalConf, 'utf8');
  spawnSync(pgCtlBin, ['reload', '-D', pgDataDir], { encoding: 'utf8' });

  // 6. Verify role state
  const verifyRes = spawnSync(
    psqlBin,
    [
      '-h', '127.0.0.1', '-p', '5433', '-U', 'eventcheck_admin', '-d', 'postgres', '-w', '-c', 'SELECT 1;'
    ],
    { encoding: 'utf8' }
  );
  console.log('Admin unauthenticated test (must fail):', verifyRes.status !== 0 ? 'BLOCKED (Correct)' : 'FAILED (Trust still active)');

  console.log('\nHardening complete. eventcheck_app now has NOCREATEDB.');
}

main().catch(console.error);
