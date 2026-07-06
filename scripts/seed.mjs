#!/usr/bin/env node
/**
 * Seed the database with demo data (Person 2 + Person 4 — Day 6 reproducibility).
 *
 *   node scripts/seed.mjs           # or: npm run seed
 *
 * Loads the real Day-1 artifacts (multilingual enriched submissions + Person 4's
 * ranked priorities), plus deterministic mock embeddings so pgvector similarity
 * search works over the seeded set. Idempotent: re-running upserts, never dupes.
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (writes bypass RLS).
 * Run `supabase db push` first so the tables/extension exist.
 * Public datasets (public_demographics / public_facilities) load via Person 4's
 * Python loader: `python Data_Logic/mock_public_data.py`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// --- env -------------------------------------------------------------------
try {
  process.loadEnvFile(resolve(root, '.env.local'));
} catch {
  /* no .env.local — rely on already-exported env */
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error(
    'Missing SUPABASE_URL and/or a key. Set SUPABASE_SERVICE_ROLE_KEY in .env.local. See .env.example.'
  );
  process.exit(1);
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  No service-role key — inserts will fail if RLS is enabled.\n');
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- helpers ---------------------------------------------------------------
const readJson = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf-8'));

function contentHash(s) {
  return createHash('sha256')
    .update(
      [s.citizen_id_hash || '', (s.raw_text || '').trim(), s.audio_url || '', s.photo_url || '', s.language || ''].join('|')
    )
    .digest('hex');
}

// Deterministic 768-dim unit vector (mirrors lib/server/embedding.js mock).
function mockEmbed(text) {
  const seed = createHash('sha256').update(text || '').digest();
  let state = seed.readUInt32BE(0) || 1;
  const rand = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff) * 2 - 1;
  };
  const v = new Array(768);
  let norm = 0;
  for (let i = 0; i < 768; i++) {
    v[i] = rand();
    norm += v[i] * v[i];
  }
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => Number((x / norm).toFixed(6)));
}

async function upsert(table, rows, onConflict) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) {
    console.error(`✗ ${table}: ${error.message}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${table}: ${rows.length} rows`);
  }
}

// --- seed ------------------------------------------------------------------
async function main() {
  const enriched = readJson('lib/day1_enriched_submissions.json');
  const priorities = readJson('lib/day1_priorities_v2.json');

  // 1. Raw submissions (parent rows first for FK integrity)
  const submissions = enriched.map((s) => ({
    id: s.id,
    timestamp: s.timestamp,
    channel: s.channel || 'web',
    raw_text: s.raw_text ?? null,
    audio_url: s.audio_url ?? null,
    photo_url: s.photo_url ?? null,
    language: s.language,
    geo: s.geo ?? null,
    citizen_id_hash: s.citizen_id_hash || 'seed',
    content_hash: contentHash(s),
  }));
  await upsert('submissions', submissions, 'id');

  // 2. Enriched submissions
  const enrichedRows = enriched.map((s) => ({
    id: s.id,
    normalized_text_en: s.normalized_text_en || s.raw_text || '',
    category: s.category || 'Sanitation',
    need_type: s.need_type || 'General',
    urgency: s.urgency || 'Medium',
    sentiment: s.sentiment || 'Neutral',
    canonical_location: s.canonical_location ?? null,
    extracted_entities: Array.isArray(s.extracted_entities) ? s.extracted_entities : [],
  }));
  await upsert('enriched_submissions', enrichedRows, 'id');

  // 3. Embeddings (on the English canonical) so similarity search demos work
  const embeddings = enriched.map((s) => ({
    submission_id: s.id,
    vector: mockEmbed(s.normalized_text_en || s.raw_text || ''),
  }));
  await upsert('embeddings', embeddings, 'submission_id');

  // 4. Ranked priorities (Person 4's real scoring output)
  const priorityRows = priorities.map((p) => ({
    work_id: p.work_id,
    title: p.title,
    category: p.category,
    demand_score: p.demand_score ?? 0,
    demand_count: p.demand_count ?? 0,
    hotspot_geo: p.hotspot_geo ?? {},
    supporting_evidence: p.supporting_evidence ?? [],
    rank: p.rank ?? null,
    explanation: p.explanation || '',
  }));
  await upsert('priorities', priorityRows, 'work_id');

  console.log(
    process.exitCode ? '\nSeed finished with errors.' : '\n✅ Seed complete.'
  );
}

main().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
