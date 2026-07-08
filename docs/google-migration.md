# Migration to Google Services — Report & Tracker

Branch: `migrate-google-services` · Generated 2026-07-08

Goal: move every non-Google external dependency to a Google Cloud equivalent.
This doc is the tracker — we work through the services one by one and check them off.

---

## Summary

| # | Service (current) | Role | Google target | Size | Status |
|---|-------------------|------|---------------|------|--------|
| 1 | **Nominatim / OpenStreetMap** | Reverse geocoding | Google Maps Geocoding API | S | ✅ Done & verified live |
| 2 | **Tavily** | Web search (enrichment + news) | Custom Search JSON API | M | ⚠️ Code done — needs API key + `cx` |
| 3 | **Mapbox GL** | Interactive maps / heatmaps | Google Maps JavaScript API | M | ⚠️ Code done — needs Maps JS API browser key |
| 4 | **Supabase** | Postgres DB + Storage | Cloud SQL (Postgres + pgvector) + Cloud Storage | L | ☐ Not started |

**Already Google — no migration needed:** Gemini (`generativelanguage`), Google Cloud
Translation (`/api/translate`), Google Places API (enrichment + ingestion), Google Cloud
Speech-to-Text (ingestion service). `storage.googleapis.com` URLs in seed/mock data are
placeholder image links, not a live integration.

**Out of scope (hosting, not a code dependency):** the Person-1 guide mentions Vercel for
frontend hosting; the `Dockerfile` already targets Cloud Run. Hosting swap is optional and
separate from these service migrations.

---

## 1. Nominatim → Google Maps Geocoding API  `[S]`

Reverse-geocode lat/lng → neighbourhood name on the `/submit` enrichment path.

- **Where:** [lib/server/enrichment.js:258-278](../lib/server/enrichment.js#L258) (`reverseGeocode`)
- **Endpoint now:** `https://nominatim.openstreetmap.org/reverse`
- **Target:** `https://maps.googleapis.com/maps/api/geocode/json?latlng=…&key=…`
- **Why easy:** the same file already calls **Google Places** (`maps.googleapis.com`,
  [enrichment.js:239](../lib/server/enrichment.js#L239)) with an API key, so the key infra
  and fetch pattern already exist. Only the URL + response parsing changes; the
  process-lifetime `geocodeCache` stays as-is.
- **Env:** key resolves as `GOOGLE_MAPS_API_KEY || GOOGLE_API_KEY` (works with the currently-set key).
- **Status:** ✅ **Done & verified live.** Reverse geocode now hits Google Geocoding, parses
  `address_components` (neighborhood → sublocality → locality → …), degrades to `null` on error.
  Dedicated `GOOGLE_MAPS_API_KEY` set in `.env.local` (git-ignored). Live checks both `OK`:
  Geocoding → "KHB Block Koramangala"; Places → "NYICS".
- **Bonus:** the same key also activated the pre-existing **Places** amenity-check
  ([enrichment.js:218](../lib/server/enrichment.js#L218)), which was silently mocking `true`
  because `GOOGLE_MAPS_API_KEY` had never been set.

## 2. Tavily → Gemini Grounding or Custom Search JSON API  `[M]`

Web search for (a) real-time enrichment context and (b) civic news ingestion.

- **Where:**
  - [lib/server/enrichment.js:103-123](../lib/server/enrichment.js#L103) (`performTavilySearch`)
  - [app/api/proactive/ingest/route.js:16-64](../app/api/proactive/ingest/route.js#L16) (`tavilySearch`, news ingest)
  - [lib/server/newsIngest.js](../lib/server/newsIngest.js) (consumes the results)
  - Python: [services/ingestion/ingestion/tools.py:35](../services/ingestion/ingestion/tools.py#L35), `providers.py`, `config.py`
- **Endpoint now:** `https://api.tavily.com/search`
- **Target — recommended:** **Gemini with the Google Search grounding tool** (`google_search`)
  — Gemini is already wired up (`lib/server/gemini.js`), so no new vendor and search results
  come back already summarised. Alternative if we need raw ranked links: **Custom Search JSON
  API** (`customsearch/v1`, needs a Programmable Search Engine ID).
- **Decision made:** **Custom Search JSON API for both** (not grounding). Both call sites feed
  *raw web snippets* into a model/classifier — Custom Search is a true drop-in that returns the
  same shape Tavily did, with one key + one `cx`. Grounding would have changed the semantics
  (model-summarised answer vs raw snippets) and needed an extra Gemini call.
- **Implementation:** new shared helper [lib/server/googleSearch.js](../lib/server/googleSearch.js)
  (`googleWebSearch`, `isGoogleSearchConfigured`) returns `{title, content, url, published_date}`.
  - Enrichment: `performTavilySearch` → `performWebSearch` ([enrichment.js](../lib/server/enrichment.js#L103)).
  - Ingestion: `tavilySearch` → `newsSearch` + preflight now checks `isGoogleSearchConfigured()`
    ([proactive/ingest/route.js](../app/api/proactive/ingest/route.js)).
  - Python service: `search_local_news` now hits Custom Search ([tools.py](../services/ingestion/ingestion/tools.py#L34)),
    `config.py` swaps `tavily_api_key` → `google_search_api_key`/`google_search_cx`.
  - Comments in `newsIngest.js`, env templates all updated. JS lints clean; Python `py_compile` OK.
- **Env:** `TAVILY_API_KEY` (removed) → `GOOGLE_SEARCH_API_KEY` (falls back to `GOOGLE_API_KEY`)
  + `GOOGLE_SEARCH_CX`. Placeholders added to `.env.local`, `.env.example`, `services/ingestion/.env.example`.
- **⚠️ ACTION REQUIRED (user):** provide a **Custom Search API key** (or enable Custom Search API on
  the `GOOGLE_API_KEY` project) **and** a **Programmable Search Engine id (`cx`)**. Until both are set,
  enrichment web-search returns `null` and `/proactive/ingest` returns `501 not configured` — no crashes.

## 3. Mapbox GL → Google Maps JavaScript API  `[M]`

Interactive maps, markers, and hotspot heatmaps on the dashboards.

- **Where:**
  - [components/dashboard/HotspotMap.tsx](../components/dashboard/HotspotMap.tsx) (markers + geojson heatmap source)
  - [app/page.tsx](../app/page.tsx) (real-time telemetry map)
  - [components/dashboard/DashboardShell.tsx](../components/dashboard/DashboardShell.tsx), [ProactiveAnalysisPanel.tsx](../components/dashboard/ProactiveAnalysisPanel.tsx) (labels/fallbacks)
  - Duplicate under `frontend/components/dashboard/HotspotMap.tsx` (legacy copy — confirm if live)
- **Package now:** `mapbox-gl` + `@types/mapbox-gl`
- **Decision made:** `@googlemaps/js-api-loader` (imperative, matches the existing ref/useEffect
  structure and preserves the keyless fallbacks). Installed; removed `mapbox-gl` + `@types/mapbox-gl`.
- **⚠️ Heatmap gotcha:** Google **removed** `visualization.HeatmapLayer` in Maps JS **v3.65** (current).
  Rather than pull in deck.gl (3 pkgs) for one visual, the hotspot heatmap is rendered as intensity
  "glow" `AdvancedMarkerElement` overlays — the same look the fallback already uses, zero new deps.
  (If a true density heatmap is wanted later, deck.gl `GoogleMapsOverlay` is the upgrade path.)
- **Implementation:**
  - [HotspotMap.tsx](../components/dashboard/HotspotMap.tsx) — Google map + glow heatmap + numbered
    `AdvancedMarkerElement` markers; `flyTo` → `panTo`/`setZoom`; async loader with `mapReady` gating.
  - [ProactiveAnalysisPanel.tsx](../components/dashboard/ProactiveAnalysisPanel.tsx) — Google map +
    emoji priority markers (⚠/⚡/ℹ); same loader/marker pattern.
  - Label text in [DashboardShell.tsx](../components/dashboard/DashboardShell.tsx) / [app/page.tsx](../app/page.tsx) de-Mapboxed.
  - `tsconfig.json` now excludes the standalone `frontend/` scaffold (separate project, still on
    Mapbox, not imported by the app) so the root build doesn't type-check it.
  - Markers use `AdvancedMarkerElement`, which needs a **Map ID** — defaults to Google's
    `DEMO_MAP_ID`, overridable via `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`.
- **Env:** `NEXT_PUBLIC_MAPBOX_TOKEN` → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (+ optional
  `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`). Both map components keep their keyless fallback.
- **Status:** `npm run build` passes (typecheck + compile). Renders the fallback until a key is set.
- **⚠️ ACTION REQUIRED (user):** provide a **browser** Maps key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)
  with the **Maps JavaScript API** enabled; restrict it to that API + your HTTP referrers. This must be
  a *separate* public key from the server-side `GOOGLE_MAPS_API_KEY` (Geocoding/Places).
- **Note:** the `frontend/` duplicate still uses Mapbox but is dead (own project, not built/deployed).

## 4. Supabase → Cloud SQL (Postgres + pgvector) + Cloud Storage  `[L]`

The biggest lift — Supabase provides the primary database **and** media storage.

**Database (Supabase JS / PostgREST):** [utils/supabase/server.js](../utils/supabase/server.js)
is the single client used by ~14 API routes.
- **Tables:** `submissions`, `enriched_submissions`, `embeddings`, `priorities`, `cases`,
  `departments`, `proactive_alerts`
- **RPCs (custom SQL fns):** `match_submissions` (pgvector similarity), `convert_proactive_alert`,
  `increment_active_cases`
- **Consumers:** every route under [app/api/](../app/api/) that hits the DB (`submit`,
  `submissions`, `cases`, `cases/[id]`, `priorities`, `priorities/[id]/*`, `hotspots`,
  `proactive`, `proactive/ingest`, `proactive/convert`, `internal/similar`,
  `dashboard/health`, `dashboard/departments`), plus `lib/server/scoring.js`, `pipeline.js`, `mappers.js`.

**Storage:** [lib/server/media.js:32-48](../lib/server/media.js#L32) uploads audio/photo to a
Supabase Storage bucket (`SUPABASE_MEDIA_BUCKET`), with a data-URI fallback.

**Raw Postgres (already portable):** `pg` (Node) and `psycopg2` (Python,
[Data_Logic/db_client.py](../Data_Logic/db_client.py)) connect via `DATABASE_URL` — these keep
working by just pointing `DATABASE_URL` at Cloud SQL. Only the **Supabase JS client**
(PostgREST calls + `.rpc()` + `.storage`) needs rewriting.

- **Target — recommended:** **Cloud SQL for PostgreSQL** with the `pgvector` extension. This
  keeps the schema, the SQL migrations, and pgvector search intact — we replace the Supabase
  JS calls with raw `pg` queries (or Cloud SQL connector) and the `.rpc()` functions become
  plain SQL/functions. Lowest-rewrite path.
  - *Alternative:* Firestore + Vertex AI Vector Search — far larger rewrite (NoSQL remodel,
    no pgvector, RPC logic reimplemented). Not recommended unless we want fully serverless.
- **Storage target:** Google Cloud Storage (`@google-cloud/storage`) — swap the upload +
  `getPublicUrl` calls in `media.js`; keep the data-URI fallback.
- **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_*`,
  `SUPABASE_MEDIA_BUCKET` → `DATABASE_URL` (Cloud SQL) + `GCS_BUCKET` + service-account creds.
- **⚠️ Decision needed before starting:** Cloud SQL (keep Postgres/pgvector) vs Firestore.

---

## Recommended order

Small, self-contained wins first to build momentum; Supabase last (it touches everything and
needs the target decision):

1. **Nominatim → Google Geocoding** — one function, key infra already present.
2. **Tavily → Google Search** — contained, ~3 JS files + Python ingestion.
3. **Mapbox → Google Maps** — visible, self-contained frontend swap.
4. **Supabase → Cloud SQL + GCS** — largest; do after confirming the DB target.
