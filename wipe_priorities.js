import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Wiping priorities...");
  const { error } = await supabase.from('priorities').delete().neq('work_id', 'dummy');
  if (error) console.error("Error:", error);
  else console.log("Priorities wiped successfully!");
}
run();
