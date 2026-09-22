const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.ttotcyiczuhkfexjyawv:tkfkdgoehdldi@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres",
  });
  try {
    await client.connect();
    console.log("Connected to Supabase.");
    
    // Add is_deleted column if it doesn't exist
    const sql = `
      ALTER TABLE todos 
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
    `;
    await client.query(sql);
    console.log("Added is_deleted column successfully!");
  } catch (err) {
    console.error("Error setting up DB:", err);
  } finally {
    await client.end();
  }
}

run();
