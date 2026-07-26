/**
 * 健壮的 SQL 数据导入脚本 v2
 * 策略：先将 JSON 列临时改为 TEXT，导入后改回 JSON
 */
import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const sqlFile = process.argv[2] || '/home/ubuntu/upload/t100-command-data-export.sql';
const sql = readFileSync(sqlFile, 'utf8');

const conn = await createConnection(url);

// ── Step 1: Convert JSON columns to TEXT ──────────────────────────────────
console.log('Step 1: Converting JSON columns to TEXT for import...');
const alterToText = [
  'ALTER TABLE `clients` MODIFY COLUMN `monitorKeywords` TEXT',
  'ALTER TABLE `meddpicc_snapshots` MODIFY COLUMN `scores` TEXT',
  'ALTER TABLE `opportunity_scores` MODIFY COLUMN `warnings` TEXT',
  'ALTER TABLE `arsenal_weapons` MODIFY COLUMN `tags` TEXT',
];
for (const s of alterToText) {
  try { await conn.execute(s); console.log(`  ✓ ${s.substring(0,60)}`); }
  catch (e) { console.warn(`  WARN: ${e.message.substring(0,80)}`); }
}

// ── Step 2: Parse and execute all statements ───────────────────────────────
function splitStatements(sql) {
  const stmts = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let escaped = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (escaped) { current += ch; escaped = false; continue; }
    if (ch === '\\' && inString) { current += ch; escaped = true; continue; }
    if (inString) {
      current += ch;
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inString = true; stringChar = ch; current += ch; continue;
    }
    if (ch === ';') {
      const stmt = current.trim();
      if (stmt.length > 0) stmts.push(stmt);
      current = '';
      continue;
    }
    current += ch;
  }
  const last = current.trim();
  if (last.length > 0) stmts.push(last);
  return stmts;
}

const statements = splitStatements(sql).filter(s => {
  const upper = s.toUpperCase().trimStart();
  return upper.startsWith('SET ') || upper.startsWith('TRUNCATE ') ||
         upper.startsWith('INSERT ') || upper.startsWith('UPDATE ') ||
         upper.startsWith('DELETE ');
});

console.log(`\nStep 2: Executing ${statements.length} SQL statements...`);
let ok = 0, failed = 0;
for (const stmt of statements) {
  const preview = stmt.substring(0, 70).replace(/\n/g, ' ');
  try {
    await conn.execute(stmt);
    ok++;
    const upper = stmt.toUpperCase().trimStart();
    if (upper.startsWith('TRUNCATE') || upper.startsWith('INSERT')) {
      console.log(`  ✓ ${preview}...`);
    }
  } catch (e) {
    console.error(`  ✗ FAILED: ${preview}...`);
    console.error(`    Error: ${e.code} - ${e.sqlMessage || e.message.substring(0, 100)}`);
    failed++;
  }
}

// ── Step 3: Fix non-JSON values then restore JSON columns ─────────────────
console.log('\nStep 3: Fixing non-JSON values and restoring JSON columns...');

// Fix clients.monitorKeywords: convert 'a,b,c' to JSON array
try {
  const [rows] = await conn.execute('SELECT id, monitorKeywords FROM `clients`');
  for (const row of rows) {
    const val = row.monitorKeywords;
    if (val && !val.startsWith('[') && !val.startsWith('{') && val !== 'null') {
      const parts = val.split(',').map(s => s.trim()).filter(Boolean);
      const jsonVal = JSON.stringify(parts);
      await conn.execute('UPDATE `clients` SET `monitorKeywords` = ? WHERE id = ?', [jsonVal, row.id]);
    }
  }
  console.log('  ✓ Fixed clients.monitorKeywords');
} catch (e) { console.warn(`  WARN clients.monitorKeywords: ${e.message.substring(0,80)}`); }

// Fix arsenal_weapons.tags: convert 'a,b,c' to JSON array
try {
  const [rows] = await conn.execute('SELECT id, tags FROM `arsenal_weapons`');
  for (const row of rows) {
    const val = row.tags;
    if (val && !val.startsWith('[') && !val.startsWith('{') && val !== 'null') {
      const parts = val.split(',').map(s => s.trim()).filter(Boolean);
      const jsonVal = JSON.stringify(parts);
      await conn.execute('UPDATE `arsenal_weapons` SET `tags` = ? WHERE id = ?', [jsonVal, row.id]);
    }
  }
  console.log('  ✓ Fixed arsenal_weapons.tags');
} catch (e) { console.warn(`  WARN arsenal_weapons.tags: ${e.message.substring(0,80)}`); }

// Fix meddpicc_snapshots.scores: replace '[object Object]' with valid JSON
try {
  const defaultScores = JSON.stringify({
    metricsScore:0, economicBuyerScore:0, decisionCriteriaScore:0,
    decisionProcessScore:0, paperProcessScore:0, implicatePainScore:0,
    championScore:0, competitionScore:0, totalScore:0
  });
  await conn.execute(
    "UPDATE `meddpicc_snapshots` SET `scores` = ? WHERE `scores` = '[object Object]'",
    [defaultScores]
  );
  console.log('  ✓ Fixed meddpicc_snapshots.scores');
} catch (e) { console.warn(`  WARN meddpicc_snapshots: ${e.message.substring(0,80)}`); }

// Fix opportunity_scores.warnings: wrap plain text in JSON array
try {
  const [rows] = await conn.execute('SELECT id, warnings FROM `opportunity_scores`');
  for (const row of rows) {
    const val = row.warnings;
    if (val && !val.startsWith('[') && !val.startsWith('{') && val !== 'null') {
      const jsonVal = JSON.stringify([val]);
      await conn.execute('UPDATE `opportunity_scores` SET `warnings` = ? WHERE id = ?', [jsonVal, row.id]);
    }
  }
  console.log('  ✓ Fixed opportunity_scores.warnings');
} catch (e) { console.warn(`  WARN opportunity_scores: ${e.message.substring(0,80)}`); }

// Restore JSON columns
const alterToJson = [
  "ALTER TABLE `clients` MODIFY COLUMN `monitorKeywords` JSON",
  "ALTER TABLE `meddpicc_snapshots` MODIFY COLUMN `scores` JSON",
  "ALTER TABLE `opportunity_scores` MODIFY COLUMN `warnings` JSON",
  "ALTER TABLE `arsenal_weapons` MODIFY COLUMN `tags` JSON",
];
for (const s of alterToJson) {
  try { await conn.execute(s); console.log(`  ✓ Restored: ${s.substring(0,60)}`); }
  catch (e) { console.warn(`  WARN (restore): ${e.message.substring(0,100)}`); }
}

// ── Step 4: Verify row counts ─────────────────────────────────────────────
console.log('\nStep 4: Verifying row counts...');
const tables = ['clients','key_contacts','opportunities','arsenal_weapons','listprice_items',
                'meddpicc','opportunity_meddpicc','pod_tasks','action_items','meeting_minutes'];
for (const table of tables) {
  try {
    const [rows] = await conn.execute(`SELECT COUNT(*) as cnt FROM \`${table}\``);
    console.log(`  ${table}: ${rows[0].cnt} rows`);
  } catch (e) { console.warn(`  ${table}: ERROR - ${e.message.substring(0,50)}`); }
}

console.log(`\n✅ Import complete: ${ok} succeeded, ${failed} failed`);
await conn.end();
process.exit(0);
