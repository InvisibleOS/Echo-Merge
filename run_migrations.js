import pg from 'pg'
import fs from 'fs'
import path from 'path'

// Clear any global PG env variables that could override explicit config
delete process.env.PGUSER;
delete process.env.PGPASSWORD;
delete process.env.PGHOST;
delete process.env.PGPORT;
delete process.env.PGDATABASE;

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
  console.log("Connected to Supabase Postgres database.")

  // Find all migrations in order
  const dir = "supabase/migrations"
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => path.join(dir, f))
  
  for (const file of files) {
    console.log(`Applying migration: ${file}`)
    const sql = fs.readFileSync(file, 'utf8')
    try {
      await client.query(sql)
      console.log(`Successfully applied: ${file}`)
    } catch (err) {
      console.error(`Error in ${file}:`, err.message)
    }
  }

  await client.end()
  console.log("All migrations executed!")
}

run().catch(err => {
  console.error("Migrations runner failed:", err)
  process.exit(1)
})
