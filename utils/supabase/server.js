import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client (Person 2 — Backend).
 *
 * This is the single privileged database handle used by every API route
 * (`/submit`, `/submissions`, `/priorities`, `/hotspots`, internal RAG).
 * It talks to Cloud SQL / Supabase Postgres (with the pgvector extension).
 *
 * Env resolution is intentionally forgiving so the same code runs in local
 * dev, CI, and Cloud Run without renaming variables:
 *
 *   URL  ← SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL
 *   KEY  ← SUPABASE_SERVICE_ROLE_KEY   (preferred — bypasses RLS for writes)
 *          | SUPABASE_ANON_KEY
 *          | SUPABASE_KEY
 *          | NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *          | NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * For production writes set SUPABASE_SERVICE_ROLE_KEY. With only a
 * publishable/anon key the pipeline can still read, but inserts will fail if
 * Row Level Security is enabled on the tables. See /docs/deployment.md.
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const fallbackKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseKey = serviceRoleKey || fallbackKey;

// Surface a one-time warning when we fall back to a non-privileged key, so a
// silent RLS write failure doesn't get mistaken for a bug during the demo.
if (supabaseUrl && supabaseKey && !serviceRoleKey) {
  console.warn(
    '[supabase] Using a non-service-role key. Reads work, but inserts/updates ' +
      'will fail if RLS is enabled. Set SUPABASE_SERVICE_ROLE_KEY for the write path.'
  );
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : new Proxy(
      {},
      {
        get(_target, prop) {
          throw new Error(
            `Supabase client not configured: cannot access '${prop.toString()}'. ` +
              'Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and a key ' +
              '(SUPABASE_SERVICE_ROLE_KEY preferred) in your environment. ' +
              'See .env.example.'
          );
        },
      }
    );
