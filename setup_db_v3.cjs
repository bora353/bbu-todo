const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.ttotcyiczuhkfexjyawv:tkfkdgoehdldi@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres",
  });
  try {
    await client.connect();
    console.log("Connected to Supabase.");
    
    await client.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;`);
    console.log("Added completed_at column");
    
  } catch (err) {
    console.error("Error setting up DB:", err);
  } finally {
    await client.end();
  }
}

run();
