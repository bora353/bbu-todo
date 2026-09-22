const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.ttotcyiczuhkfexjyawv:tkfkdgoehdldi@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres",
  });
  try {
    await client.connect();
    console.log("Connected to Supabase.");
    
    const sql = `
      create table if not exists subscriptions (
        id uuid default gen_random_uuid() primary key,
        user_name text not null,
        endpoint text not null unique,
        keys jsonb not null,
        created_at timestamp with time zone default now()
      );
    `;
    await client.query(sql);
    console.log("Subscriptions table created successfully!");
  } catch (err) {
    console.error("Error setting up DB:", err);
  } finally {
    await client.end();
  }
}

run();
