const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.ttotcyiczuhkfexjyawv:tkfkdgoehdldi@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres",
  });
  try {
    await client.connect();
    console.log("Connected to Supabase.");
    
    await client.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS recurrence VARCHAR(20) DEFAULT 'none';`);
    console.log("Added recurrence column");
    
    await client.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT '';`);
    console.log("Added category column");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS post_it (
        id INT PRIMARY KEY,
        message TEXT,
        author VARCHAR(50),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("Created post_it table");
    
    await client.query(`
      INSERT INTO post_it (id, message, author) 
      VALUES (1, '오늘도 화이팅!❤️', '쀼') 
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log("Inserted default post_it");
    
  } catch (err) {
    console.error("Error setting up DB:", err);
  } finally {
    await client.end();
  }
}

run();
