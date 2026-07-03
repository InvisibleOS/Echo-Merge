import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : new Proxy(
        {},
        {
          get(target, prop) {
            throw new Error(
              `Supabase client error: Attempted to access '${prop.toString()}' but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in the environment. Please verify your .env.local file configuration.`
            );
          },
        }
      );
