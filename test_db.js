import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://febbybhukhaiwncjaqob.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlYmJ5Ymh1a2hhaXduY2phcW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNTU1NzgsImV4cCI6MjA5ODYzMTU3OH0.5rcSoPyjJmdcoeTKxaXW3RqNPJ0JWJlxCYOUBpCrPKE'
)

async function run() {
  const { data, error } = await supabase.from('priorities').select('*').limit(1)
  console.log({data, error})
}

run()
