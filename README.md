# People's Priorities — AI for Constituency Development Planning

A multilingual civic platform where citizens submit development needs (**text /
voice / photo**) in **any major Indian language**. An AI ingestion layer
transcribes and translates each submission, Gemini structures it, an
**embedding + RAG layer** (pgvector) clusters recurring demand into themes and
geographic hotspots, and a **priority-scoring** algorithm fuses that with
public/demographic data into a **ranked, explainable priority list** on an
MP-facing dashboard.

> **Demo constituency:** Bengaluru South · **Languages:** Hindi, Kannada, Tamil,
> English (+ more via the same pipeline).

---

## Architecture

```
Citizen web app (text / voice / photo · any Indian language)   ← Person 1
        │  POST /submit
        ▼
Ingestion API (Next.js Route Handlers on Cloud Run)            ← Person 2  ◀── this repo's backend
        │
        ├─ store raw            → submissions            (Postgres)
        ├─ enrich  (Gemini)     → enriched_submissions              ← Person 3
        ├─ embed   (Vertex AI)  → embeddings             (pgvector) ← Person 4
        └─ rescore + re-rank    → priorities                        ← Person 4 (batch) / Person 2 (live)
        │
        ▼
MP Dashboard  ← GET /priorities · GET /hotspots · GET /submissions ← Person 1
              ← POST /api/internal/similar  (RAG top-k)            → Person 4
```

The pipeline seams (enrichment, embedding) are HTTP services owned by Persons 3
& 4. If their `*_SERVICE_URL` env vars are unset, the backend uses built-in
**deterministic mocks**, so a fresh clone runs end-to-end with no external AI.

### Which Google tech is used where
| Layer | Technology |
|---|---|
| API + app hosting | **Cloud Run** (`Dockerfile`, Next.js standalone) |
| Database + vector search | **Cloud SQL / Supabase Postgres** + **pgvector** |
| Enrichment / translation | **Vertex AI — Gemini** (Person 3) |
| Embeddings | **Vertex AI text-embeddings** (Person 4) |
| Voice → text | **Cloud Speech-to-Text V2** (Person 3) |
| Maps / heatmap | **Google Maps Platform / Mapbox** (Person 1) |

---

## Quick start (clone → run)

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local
#   Fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (writes) at minimum.

# 3. Create schema (pgvector, tables, indexes, match RPC)
npm run db:push            # supabase db push  (or psql the migrations in order)

# 4. Seed demo data (multilingual submissions + ranked priorities + embeddings)
npm run seed

# 5. Run
npm run dev                # http://localhost:3000
```

Frontend-only preview without a database: set `NEXT_PUBLIC_USE_MOCK_DATA=true`
(the app serves bundled mock data — see `lib/mockData.ts`).

---

## API (frozen contract → [`docs/contracts.md`](docs/contracts.md))

| Method | Path | Purpose | Response |
|---|---|---|---|
| `POST` | `/api/submit` | ingest a submission (idempotent) | `SubmitResponse` |
| `GET` | `/api/submissions?work_id=` | raw+translated submissions / drill-down | `EnrichedSubmission[]` |
| `GET` | `/api/priorities?sortBy=` | ranked priorities | `PriorityItem[]` |
| `GET` | `/api/hotspots` | map heatmap points | `Hotspot[]` |
| `POST` | `/api/internal/similar` | pgvector top-k (for RAG) | `{ matches[] }` |

The API is served under `/api/*`; set `NEXT_PUBLIC_API_BASE_URL=<origin>/api`.
Bare `/submit` is the citizen form *page*, not the API (see `docs/contracts.md` §2).

```bash
# smoke test
curl -X POST localhost:3000/api/submit -H 'content-type: application/json' \
  -d '{"raw_text":"सड़क पर बड़ा गड्ढा है","language":"hi","geo":{"lat":12.9,"lng":77.6},"citizen_id_hash":"demo1"}'
curl localhost:3000/api/priorities
curl localhost:3000/api/hotspots
```

---

## Layout

```
app/api/            Route Handlers: submit, submissions, priorities, hotspots, internal/similar
lib/server/         Backend modules: pipeline, enrichment, embedding, scoring, cache, validation, mappers
lib/types.ts        Shared TypeScript contract (mirrors docs/contracts.md)
utils/supabase/     Server-side Supabase client
supabase/migrations Schema, pgvector index, RPC, idempotency (run in filename order)
scripts/seed.mjs    Idempotent demo-data loader
Data_Logic/         Person 4: scoring, embeddings, public-data loaders (Python)
docs/               contracts.md · deployment.md
```

## Docs
- **[docs/contracts.md](docs/contracts.md)** — frozen data + API contract.
- **[docs/deployment.md](docs/deployment.md)** — Cloud Run deploy, onboarding a
  new constituency, pgvector scaling, reliability guarantees.

## Security
No secrets are committed. `.env*` is git-ignored; provide values via `.env.local`
locally and Cloud Run secrets in production. `SUPABASE_SERVICE_ROLE_KEY` must
never carry a `NEXT_PUBLIC_` prefix.
