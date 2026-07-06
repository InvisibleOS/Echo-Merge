# Deployment & Onboarding (Backend — Person 2)

How the backend runs, how a **new constituency** is onboarded in weeks (the 25%
"deployability" story), and how the data layer scales.

---

## 1. What runs where (Google stack)

| Concern | Service |
|---|---|
| API + app server | **Cloud Run** (container from `Dockerfile`) |
| Database | **Cloud SQL for PostgreSQL** / Supabase Postgres |
| Vector search | **pgvector** extension on the same Postgres |
| Enrichment | **Vertex AI — Gemini** (Person 3, behind `ENRICHMENT_SERVICE_URL`) |
| Embeddings | **Vertex AI text-embeddings** (Person 4, behind `EMBEDDING_SERVICE_URL`) |
| Speech-to-Text | **Cloud Speech-to-Text V2** (Person 3, upstream of `/submit`) |
| Maps | **Google Maps Platform / Mapbox** (Person 1, frontend) |

## 2. Environment

Copy `.env.example` → `.env.local` (local) or set as Cloud Run env/secrets.
Minimum for the backend:

- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` — **required for writes** when RLS is on. Store as
  a Cloud Run secret, never `NEXT_PUBLIC_`.
- `DATABASE_URL` — for migrations, seeding, and the Python data pipeline.
- Optional: `ENRICHMENT_SERVICE_URL`, `EMBEDDING_SERVICE_URL`. If unset, the
  pipeline uses built-in deterministic mocks so a fresh clone still runs
  end-to-end.

## 3. Database setup

```bash
# 1. Enable pgvector + create all tables, indexes, and the match RPC
supabase db push                 # applies everything in supabase/migrations/
# (or: psql "$DATABASE_URL" -f supabase/migrations/<each>.sql in order)

# 2. Seed demo data (mock multilingual submissions + Person 4 priorities)
npm run seed
```

Migrations (idempotent, run in filename order):

1. `…_init.sql` — extension, core tables, `match_submissions` RPC
2. `…_public_data_tables.sql` — census/facilities tables
3. `…_pgvector_hnsw_index.sql` — HNSW ANN index + priority indexes
4. `…_submit_idempotency.sql` — `content_hash` + partial unique index

## 4. Deploy to Cloud Run

```bash
gcloud run deploy peoples-priorities \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-secrets SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest \
  --set-env-vars SUPABASE_URL=https://<proj>.supabase.co
```

The image uses Next.js `standalone` output and listens on `$PORT` (8080). No
build-time secrets are baked in — runtime env/secrets are injected by Cloud Run.

## 5. Pipeline reliability guarantees

- **Idempotent `/submit`** — identical content from the same citizen returns the
  original `submission_id` (dedupe via `content_hash` + DB unique index; races
  resolve to the first writer). Safe to retry.
- **Bad geo is tolerated** — out-of-range/garbage coordinates are dropped, the
  submission is still stored (never lose a citizen's report). Ward-only geo is
  accepted.
- **Missing fields** — `language` and at least one of text/audio/photo are
  required (400 otherwise); `citizen_id_hash` falls back to an anonymous derived
  id.
- **Graceful degradation** — enrichment/embedding/scoring stages are best-effort
  after the raw row is durably stored; any stage failing is logged, not fatal.

## 6. Onboarding a new constituency

The system is constituency-agnostic; nothing here is Bengaluru-specific in code.

1. **Point the DB** — new Cloud SQL/Supabase project, run `supabase db push`.
2. **Load public data** — replace the census/facilities inputs and run the
   Person 4 loaders (`Data_Logic/mock_public_data.py`, real datasets swap in at
   the same table shapes: `public_demographics`, `public_facilities`).
3. **Set wards + centroid** — the fallback centroid lives in
   `lib/server/mappers.js` / `scoring.js`; update it (or rely on ward geo).
4. **Languages** — no code change: Speech-to-Text V2 + Gemini auto-detect; the
   embedding is on English canonical so any language clusters correctly.
5. **Deploy** — same Cloud Run command with the new project's secrets.

## 7. How the data layer scales

- **Vector search** — HNSW index (`m=16, ef_construction=64`, cosine). Sub-linear
  top-k; comfortably handles 10⁵–10⁶ embeddings on a single Postgres. Tune
  `ef_search` at query time for recall vs latency; rebuild with larger `m` only
  if recall drops.
- **Read endpoints** — `/priorities` and `/hotspots` are memoised ~20s per
  instance and invalidated on each processed submission, so dashboard polling
  doesn't hammer aggregate queries. Scale horizontally on Cloud Run; the cache is
  per-instance (acceptable staleness for a dashboard).
- **Writes** — one raw insert + upserts on the enrich/embed/priority path.
  Re-ranking touches only rows whose rank changed. For very high write volume,
  move the pipeline to a Cloud Tasks/Pub-Sub queue behind `/submit` (the seam is
  already isolated in `lib/server/pipeline.js`).
