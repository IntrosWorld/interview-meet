import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
dotenv.config({ path: process.argv[2] || '.env', override: true, quiet: true });
try {
  if (!process.env.DATABASE_URL) throw new Error();
  const sql = neon(process.env.DATABASE_URL);
  const source = await readFile('database/002_desktop_login.sql', 'utf8');
  for (const statement of source.split(';').filter(s => s.trim())) await sql.query(statement);
  const rows = await sql.query("SELECT to_regclass('public.desktop_login_codes') AS name");
  if (!rows[0].name) throw new Error();
  console.log('Desktop login table verified in the selected database.');
  console.log('Firebase signing credential configured:', Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
} catch {
  console.error('Desktop migration failed. Check the selected environment and database permissions.');
  process.exitCode = 1;
}
