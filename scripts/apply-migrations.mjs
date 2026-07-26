import { readFileSync, readdirSync } from 'fs';
import { createConnection } from 'mysql2/promise';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const conn = await createConnection(url);

// Get list of migration SQL files in order
const drizzleDir = join(projectRoot, 'drizzle');
const sqlFiles = readdirSync(drizzleDir)
  .filter(f => f.endsWith('.sql') && /^\d{4}_/.test(f))
  .sort();

console.log(`Found ${sqlFiles.length} migration files`);

let applied = 0, skipped = 0, errors = 0;

for (const file of sqlFiles) {
  const content = readFileSync(join(drizzleDir, file), 'utf8');
  // Split by --> statement-breakpoint (drizzle's statement separator)
  const statements = content
    .split('--> statement-breakpoint')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    // Remove trailing semicolons and whitespace, then add one back
    const cleanStmt = stmt.replace(/;\s*$/, '').trim();
    if (!cleanStmt) continue;
    const sql = cleanStmt + ';';
    // Convert CREATE TABLE to CREATE TABLE IF NOT EXISTS
    const safeSql = sql
      .replace(/^CREATE TABLE (`[^`]+`)/, 'CREATE TABLE IF NOT EXISTS $1')
      .replace(/^CREATE UNIQUE INDEX/, 'CREATE UNIQUE INDEX IF NOT EXISTS')
      .replace(/^CREATE INDEX/, 'CREATE INDEX IF NOT EXISTS');
    try {
      await conn.execute(safeSql);
      applied++;
    } catch (e) {
      if (
        e.code === 'ER_TABLE_EXISTS_ERROR' ||
        e.code === 'ER_DUP_KEYNAME' ||
        e.code === 'ER_DUP_FIELDNAME' ||
        e.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
        e.code === 'ER_DUP_INDEX' ||
        (e.code === 'ER_PARSE_ERROR' && safeSql.includes('IF NOT EXISTS'))
      ) {
        skipped++;
      } else {
        console.warn(`  WARN [${file}]: ${e.code} - ${e.sqlMessage || e.message.substring(0, 120)}`);
        errors++;
      }
    }
  }
  console.log(`  ✓ ${file}`);
}

console.log(`\nDone: ${applied} applied, ${skipped} skipped (already exist), ${errors} warnings`);
await conn.end();
process.exit(0);
