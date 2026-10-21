import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  if (!content.includes('SHADOW_DATABASE_URL')) {
    const dbUrlMatch = content.match(/DATABASE_URL="([^"]+)"/);
    if (dbUrlMatch) {
      const shadowUrl = dbUrlMatch[1].replace('/eventcheck_dev', '/eventcheck_shadow');
      const updated = content.replace(
        dbUrlMatch[0],
        `${dbUrlMatch[0]}\nSHADOW_DATABASE_URL="${shadowUrl}"`
      );
      fs.writeFileSync(envPath, updated, 'utf8');
      console.log('Added SHADOW_DATABASE_URL to .env safely.');
    }
  } else {
    console.log('SHADOW_DATABASE_URL already present in .env.');
  }
}
