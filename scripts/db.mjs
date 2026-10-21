import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const pgDataDir = path.join(projectRoot, '.pgdata');
const serverLog = path.join(pgDataDir, 'server.log');
const pgCtlBin = 'C:\\Program Files\\Odoo 20.0.20260924\\PostgreSQL\\bin\\pg_ctl.exe';

const action = process.argv[2] || 'status';

if (action === 'status') {
  const res = spawnSync(pgCtlBin, ['status', '-D', pgDataDir], { encoding: 'utf8' });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  process.exit(res.status ?? 0);
} else if (action === 'start') {
  const res = spawnSync(pgCtlBin, ['start', '-D', pgDataDir, '-l', serverLog, '-w'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  process.exit(res.status ?? 0);
} else if (action === 'stop') {
  const res = spawnSync(pgCtlBin, ['stop', '-D', pgDataDir, '-m', 'fast', '-w'], {
    encoding: 'utf8',
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  process.exit(res.status ?? 0);
} else {
  console.error(`Unknown action: ${action}. Use status, start, or stop.`);
  process.exit(1);
}
