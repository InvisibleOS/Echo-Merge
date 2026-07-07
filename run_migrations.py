import os
import psycopg2
import glob

# Use the DIRECT_URL format for migrations
DB_URL = "postgresql://postgres.febbybhukhaiwncjaqob:piqpy0-beqGur-pebwaq@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"

print("Connecting to database...")
conn = psycopg2.connect(DB_URL)
conn.autocommit = True
cursor = conn.cursor()

# Get all migration files in order
migration_files = sorted(glob.glob("supabase/migrations/*.sql"))

for file in migration_files:
    print(f"Applying migration: {file}")
    with open(file, 'r') as f:
        sql = f.read()
        try:
            cursor.execute(sql)
            print(f"Success: {file}")
        except Exception as e:
            print(f"Error in {file}: {e}")

cursor.close()
conn.close()
print("All migrations applied!")
