import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Load .env.local
try {
  process.loadEnvFile(path.resolve(root, '.env.local'));
} catch (e) {
  console.warn('⚠️  Could not load .env.local, using process.env: ', e.message);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in environment or .env.local');
  process.exit(1);
}

// Mask password for safety in logs
const maskedConnStr = connectionString.replace(/:([^:@]+)@/, ':****@');
console.log('Using connection string:', maskedConnStr);

console.log('Connecting to database...');
const client = new pg.Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Supabase / Cloud connections
  }
});

async function main() {
  await client.connect();
  console.log('✅ Connected to database.');

  const migrationsDir = path.resolve(root, 'supabase/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files.`);

  for (const file of files) {
    console.log(`\n⏳ Running migration: ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    try {
      await client.query(sql);
      console.log(`✅ Success: ${file}`);
    } catch (err) {
      console.error(`❌ Error in migration ${file}:`);
      console.error(err.message);
      process.exitCode = 1;
      break;
    }
  }

  await client.end();
  console.log('\nMigration run completed.');
}

main().catch(async (err) => {
  console.error('Migration failed:', err);
  try {
    await client.end();
  } catch {}
  process.exit(1);
});
