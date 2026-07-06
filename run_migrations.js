import pg from 'pg'
const { Client } = pg

async function run() {
  const client = new Client({
    host: "aws-1-ap-southeast-1.pooler.supabase.com",
    port: 5432,
    database: "postgres",
    user: "postgres.febbybhukhaiwncjaqob",
    password: "KNTa069myMWDCxC",
    ssl: { rejectUnauthorized: false }
  })

  await client.connect()
  await client.query("ALTER TABLE priorities ADD COLUMN IF NOT EXISTS solution_plan JSONB;")
  console.log("Added solution_plan column")
  await client.end()
}
run()
