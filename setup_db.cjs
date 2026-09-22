const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.ttotcyiczuhkfexjyawv:tkfkdgoehdldi@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres",
  });
  try {
    await client.connect();
    console.log("Connected to Supabase.");
    
    const sql = fs.readFileSync('supabase.sql', 'utf8');
    await client.query(sql);
    console.log("Database tables created and realtime enabled!");
  } catch (err) {
    console.error("Error setting up DB:", err);
  } finally {
    await client.end();
  }
}

run();
