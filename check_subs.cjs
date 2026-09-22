const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.ttotcyiczuhkfexjyawv:tkfkdgoehdldi@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres",
  });
  try {
    await client.connect();
    const res = await client.query('SELECT * FROM subscriptions');
    console.log("Subscriptions:");
    console.log(res.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
