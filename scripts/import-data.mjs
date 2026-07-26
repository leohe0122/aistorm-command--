import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('No DATABASE_URL'); process.exit(1); }

const sqlFile = process.argv[2] || '/home/ubuntu/upload/t100-command-data-export.sql';
const sql = readFileSync(sqlFile, 'utf8');

const conn = await createConnection(url);

// Split SQL into individual statements, handling multi-line VALUES blocks
// Strategy: split on semicolons that are NOT inside strings
function splitStatements(sql) {
  const stmts = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    
    if (ch === '\\' && inString) {
      current += ch;
      escaped = true;
      continue;
    }
    
    if (inString) {
      current += ch;
      if (ch === stringChar) {
        inString = false;
      }
      continue;
    }
    
    if (ch === "'" || ch === '"' || ch === '`') {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }
    
    if (ch === ';') {
      const stmt = current.trim();
      if (stmt.length > 0) {
        stmts.push(stmt);
      }
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
  return upper.startsWith('SET ') || 
         upper.startsWith('TRUNCATE ') || 
         upper.startsWith('INSERT ') ||
         upper.startsWith('UPDATE ') ||
         upper.startsWith('DELETE ') ||
         upper.startsWith('ALTER ');
});

console.log(`Executing ${statements.length} SQL statements...`);

let ok = 0, failed = 0;
for (const stmt of statements) {
  const preview = stmt.substring(0, 80).replace(/\n/g, ' ');
  try {
    await conn.execute(stmt);
    ok++;
    if (stmt.toUpperCase().startsWith('TRUNCATE') || stmt.toUpperCase().startsWith('INSERT')) {
      console.log(`  ✓ ${preview}...`);
    }
  } catch (e) {
    console.error(`  ✗ FAILED: ${preview}...`);
    console.error(`    Error: ${e.code} - ${e.sqlMessage || e.message}`);
    failed++;
  }
}

console.log(`\nDone: ${ok} succeeded, ${failed} failed`);
await conn.end();
process.exit(failed > 0 ? 1 : 0);
