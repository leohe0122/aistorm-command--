import mysql from 'mysql2/promise';

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Step 1: Change to TEXT temporarily to allow any value
  await conn.execute("ALTER TABLE key_contacts MODIFY COLUMN relationship TEXT");
  console.log('Step 1: Changed to TEXT');
  
  // Step 2: Update old values to new equivalents
  await conn.execute("UPDATE key_contacts SET relationship = '待接触' WHERE relationship = '未接触' OR relationship IS NULL");
  console.log('Step 2: Updated 未接触 -> 待接触');
  
  // Step 3: Change back to ENUM with new values
  await conn.execute("ALTER TABLE key_contacts MODIFY COLUMN relationship ENUM('待接触', '已识别', '初步接触', '已接触', '建立关系', 'Champion', '已拒绝') DEFAULT '待接触'");
  console.log('Step 3: Changed back to ENUM with new values');
  
  const [rows] = await conn.execute("SHOW COLUMNS FROM key_contacts LIKE 'relationship'");
  console.log('Final column def:', JSON.stringify(rows[0]));
  
  await conn.end();
  console.log('Migration complete!');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
