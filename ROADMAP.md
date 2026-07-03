# Build with AI: Code for Communities — Build Roadmap

**Scope of this document:** Building the **source code** and **deployed prototype link** only.
Video and pitch deck are intentionally **out of scope** here.

**Core deliverable:** The deployed prototype is a **web app** that accepts **text, voice, and photo** submissions in **any major Indian language** — that's what satisfies the required "deployed prototype link" (a judge opens a URL and uses it). **WhatsApp/messaging intake is not built.** It's carried in the pitch deck (separate deck team) as the production channel for scaling citizen reach — zero build time, and it still demonstrates the accessibility thinking the judges score.

**Assumption:** This roadmap is written for **Track 1 — People's Priorities (AI for Constituency Development Planning)**. If you're doing a different track, ~80% of the plan still holds (multilingual intake → AI enrichment → embeddings/RAG → data fusion → ranked output → deployed dashboard); only the domain data and categories change. Tell me and I'll re-cut it.

**Deadline:** Tuesday, **July 7, 12:00 PM (noon)**.
**Time available:** Wed Jul 1 → Tue Jul 7 AM = 6 full days + one half-morning. Target being *done by ~10:30 AM on Jul 7*, not at the buzzer.

---

## The Product in One Line

A **multilingual** web platform where citizens submit development needs (voice / text / photo) in any major Indian language; an AI ingestion layer transcribes and translates each submission, Gemini structures it, an **embedding + RAG layer** clusters recurring demand into themes and geographic hotspots, a **priority-scoring algorithm** fuses that with public/demographic data, and the result is a **ranked, explainable priority list** on an MP-facing dashboard.

**Flow:**
`Citizen web app (text / voice / photo · any Indian language)` → `Ingestion API (Cloud Run)` → `Speech-to-Text V2 + Gemini translate/normalize` → `Store raw + English canonical in Postgres` → `Gemini 1.5 enrichment (category, need-type, location, urgency)` → `Embed → pgvector` → `RAG clustering (themes + hotspots + dedup)` → `Priority scoring (demand + public data + equity)` → `MP Dashboard (ranked list + Maps/Mapbox hotspot heatmap + drill-down with original + translation)`

---

## 🌐 Multilingual Support — a first-class, scored requirement

This will be used across Indian states, so language is not a nice-to-have; it's built into the pipeline and it maps directly to the **Inclusivity & Accessibility (15%)** criterion. The approach:

- **Input in any language.** A citizen types or speaks in Hindi, Telugu, Tamil, Bengali, Marathi, English, etc. **Cloud Speech-to-Text V2** transcribes voice notes in-language (it supports many Indian languages, with auto-detection).
- **Normalize to an English canonical.** **Gemini 1.5** translates + normalizes every submission to an English `normalized_text_en` while the **original text is always preserved** (`raw_text`) for display, evidence, and trust.
- **Cluster across languages.** Embeddings are generated on the English canonical and stored in **pgvector**, so a Hindi complaint and a Tamil complaint about the *same* issue land near each other and merge into one demand signal — language never fragments the ranking.
- **Show both, everywhere.** The dashboard renders the original-language text *and* its English translation on every drill-down, and Indian scripts (Devanagari, Tamil, Telugu, Bengali…) render correctly in the UI.
- **Demo target:** pick **3+ languages** to demo fully end-to-end (voice + text + photo). Architecture supports all; the demo proves a representative set.

---

## Step 1 — Divide the Work in 4 (🛠️ Role Definitions)

Four roles, one owner each. Use these tags in standups.

### **Person 1 — Frontend**
React/Next.js, Google Maps Platform, UI/UX, and Mapbox integration. Owns *everything* the user sees: the citizen submission app (text/voice/photo intake, language selector, correct Indian-script rendering) **and** the MP dashboard (ranked list, drill-downs, explanations, hotspot heatmap on Maps/Mapbox). Owns frontend hosting and the **final deployed prototype link**.

### **Person 2 — Backend**
Google Cloud Run, PostgreSQL (Cloud SQL), pgvector, and API orchestration. Owns the API layer (`/submit`, `/submissions`, `/priorities`, `/hotspots`), the database (schema, pgvector storage + similarity search), auth, the pipeline triggers that connect everyone, and backend deployment. **This is the integration hub — everyone connects through Person 2.**

### **Person 3 — AI/Ingestion**
Vertex AI (Gemini 1.5) and Cloud Speech-to-Text V2. Owns *understanding each input*: voice-note transcription, translation + normalization to English, multimodal photo tagging (broken road, garbage dump, no streetlight), and structuring each raw submission into `EnrichedSubmission` JSON. Owns multilingual coverage and quality.

### **Person 4 — Data/Logic**
RAG pipeline, embedding generation, priority-scoring algorithms, and mock-data synthesis. Owns *making sense across all inputs*: generating embeddings into pgvector, retrieval/clustering to group submissions into themes and dedup, the explainable scoring that blends demand + public data + an equity factor, sourcing the public datasets, and synthesizing realistic multilingual demo data.

**Natural pairings:** Person 3 → Person 4 are the "intelligence chain" (enrichment feeds embeddings/RAG/scoring) — they share Vertex/Gemini and should pair. Person 2 sits between Person 4 (owns pgvector tables) and everyone else.

### Shared responsibilities (all four, every day)
- **15-min standup** each morning + **15-min sync** each evening (blockers, contract changes, what merged).
- Work on feature branches, merge to `main` via PRs. `main` must always be deployable.
- **API contracts are frozen on Day 1** — this is what makes parallel work possible. Don't skip it.

---

## Step 2 — Lock These Contracts on Day 1 (so nobody is blocked)

Put these in `/docs/contracts.md`. Once frozen, each person builds against mocks and the seams "just fit" later.

**Data schemas**
- `Submission` (raw): `{ id, timestamp, channel, raw_text | audio_url | photo_url, language, geo (lat/lng or ward), citizen_id_hash }` — `channel` defaults to `"web"`, forward-compatible for a future `"whatsapp"`.
- `EnrichedSubmission` (post-AI): `Submission + { normalized_text_en, category, need_type, urgency, sentiment, canonical_location, extracted_entities }`
- `Embedding` (pgvector): `{ submission_id, vector }` — embedding generated on `normalized_text_en`.
- `PriorityItem` (dashboard-facing): `{ work_id, title, category, demand_score, demand_count, hotspot_geo, supporting_evidence, rank, explanation }`

**API endpoints**
- `POST /submit` — accept a submission (Person 1 → Person 2)
- `GET /submissions` — list raw/enriched submissions (returns original + translation)
- `GET /priorities` — ranked PriorityItems (Person 2 → Person 1)
- `GET /hotspots` — geo-aggregated demand for the map (Person 2 → Person 1)
- Internal: vector top-k similarity search over pgvector (Person 2 → Person 4's RAG)

**Demo constituency + languages:** Pick **one real constituency** and **3+ demo languages** on Day 1 and use them for everything. Concrete beats generic.

---

## Day-by-Day Roadmap

Each task starts with the responsible person in **[brackets]**. Each day ends with a definition-of-done milestone.

---

### 🗓️ Day 1 — Wed, Jul 1 · Foundation, contracts, skeletons
**Goal:** Everyone can run *something* locally tonight; all contracts frozen; nobody blocked tomorrow.

**First 2 hours — all four together:**
- Freeze the schemas + endpoints in `/docs/contracts.md`.
- Create the GitHub repo + branch strategy. Create the GCP project; enable APIs (Vertex AI + Gemini 1.5, Speech-to-Text V2, Maps Platform, Cloud Run, Cloud SQL/PostgreSQL); create a Mapbox account/token; enable the `pgvector` extension plan; share billing/credits.
- Agree the **demo storyline**, the **target constituency**, and the **3+ demo languages**.

**Then, in parallel:**
- **[Person 1 — Frontend]** Scaffold the Next.js app: citizen submission form (text input, language selector, photo upload, record-button UI) **and** a dashboard shell (ranked-list view + map panel with Maps/Mapbox loaded, dummy markers). Wire to a *mock* API. Set up frontend hosting (Vercel/Firebase/Cloud Run) with a placeholder deploy. → **EOD:** both surfaces render, form captures text+language+photo and posts to mock, map renders, **live placeholder URL exists**.
- **[Person 3 — AI/Ingestion]** Set up Vertex AI + Gemini 1.5; write the first prompt that takes raw citizen text (any language) → returns English `normalized_text_en` + structured JSON (`category, need_type, urgency, canonical_location, sentiment`). Test on 15–20 hand-written samples across 3+ Indian languages. → **EOD:** a `classify` script returns clean JSON + English normalization for multilingual inputs.
- **[Person 2 — Backend]** Provision Cloud SQL (PostgreSQL) + enable pgvector; stand up the Cloud Run API skeleton; implement *real* `POST /submit` (stores raw) and `GET /submissions`; create tables incl. the pgvector embeddings table. → **EOD:** `/submit` persists to Postgres and is callable via curl; pgvector is live.
- **[Person 4 — Data/Logic]** Stand up embedding generation (Vertex AI text-embeddings) on sample text; write the mock-data synthesizer that produces plausible **multilingual** submissions; draft scoring v0 (demand count only). → **EOD:** can embed text into a vector; synthesizer produces ~50 multilingual mock submissions.

**✅ Day 1 milestone:** Repo live, contracts frozen, Postgres+pgvector up, all 4 pieces run against mocks/samples, one deployed placeholder URL exists.

---

### 🗓️ Day 2 — Thu, Jul 2 · Make each vertical actually work (in isolation)
**Goal:** Each layer does its real job on its own. Seams still mocked.

- **[Person 1]** Build the real citizen intake UX: voice recording capture, photo upload, a language selector covering the demo languages with correct script rendering; start real dashboard components (ranked list from mock `PriorityItem`, hotspot **heatmap** layer on Maps/Mapbox). → **EOD:** citizen form captures voice+photo+text in 3+ languages; dashboard renders a ranked list + heatmap from mock data.
- **[Person 3]** Add **Cloud Speech-to-Text V2** (voice note in an Indian language → transcript) + Gemini translation/normalization (any language → English canonical, original preserved); add multimodal **photo tagging** via Gemini. → **EOD:** a Hindi/Telugu/Tamil voice note becomes an `EnrichedSubmission`; a photo gets auto-tagged.
- **[Person 2]** Implement `GET /priorities` + `GET /hotspots` (correct schemas, from seeded rows); build the **pgvector top-k similarity search** function Person 4's RAG will call; wire embedding storage. → **EOD:** endpoints return real-shaped JSON; vector top-k search works over seeded rows.
- **[Person 4]** Source + prep 2–3 real public datasets for the constituency (Census demographics, school enrollment, an amenities/infrastructure set) and load them into Cloud SQL; expand the synthesizer to a few hundred multilingual submissions; build the embedding pipeline (embed `normalized_text_en` → pgvector); scoring v1 (demand volume + recurrence). → **EOD:** public data in Postgres; hundreds of mock submissions embedded; a first ranked list with explanations.

**✅ Day 2 milestone:** Multilingual voice+text+photo intake works; Gemini enrichment works; public data + embeddings are in Postgres/pgvector; dashboard reads mock endpoints. Each part real, seams still mocked.

---

### 🗓️ Day 3 — Fri, Jul 3 · First true end-to-end thread
**Goal:** One submission travels citizen → AI → embeddings/RAG → data → dashboard **for real**. Kill the mocks at the seams.

- **[Person 2]** Wire the pipeline: `POST /submit` triggers Person 3's enrichment (Cloud Run/Function or a queue) → stores `EnrichedSubmission` → triggers Person 4's embedding + rescoring → updates the priorities table. → **EOD:** submitting via the app produces an enriched record + embedding + updated aggregate.
- **[Person 3]** Harden enrichment for messy real input (typos, code-mixed *Hinglish*, vague complaints); make sure translation preserves meaning across scripts. → **EOD:** robust classification + translation on messy multilingual text.
- **[Person 4]** Build the **RAG clustering**: for each new submission, retrieve top-k similar via pgvector to group into themes + dedup; integrate scoring with public data (e.g., weight a "new school" request by enrollment + travel distance); attach supporting citizen quotes as evidence. → **EOD:** ranking blends demand + ≥2 public-data signals + semantic clustering; every priority has a human-readable "why."
- **[Person 1]** Connect the dashboard fully to live `/priorities` + `/hotspots`; add drill-down (priority → supporting submissions shown with **original + translation**) and the real hotspot heatmap. → **EOD:** a submission made in the app appears, clustered + re-ranked, on the dashboard within the refresh cycle.

**✅ Day 3 milestone (the big one):** **One true end-to-end path works** — submit in app (text/voice/photo, any language) → translated + categorized → embedded + clustered → scored + ranked → mapped on the MP dashboard with original+translated evidence.

---

### 🗓️ Day 4 — Sat, Jul 4 · Breadth, realism, and volume
**Goal:** Make it convincing at scale on realistic multilingual data.

- **[Person 4]** Synthesize realistic volume (a few hundred to a couple thousand multilingual submissions across wards/categories/languages) and embed them all; tune scoring so top priorities are *defensible*; add an **equity/underserved factor** so neglected areas surface; add a confidence note per item. → **EOD:** dashboard runs on realistic multilingual volume; top-10 priorities are sensible + explainable.
- **[Person 2]** Performance: add a pgvector index (HNSW/IVFFlat), cache hot queries, ensure `/priorities` + `/hotspots` are snappy at volume; deploy the backend on Cloud Run at a stable URL. → **EOD:** backend is fast at volume and deployed at a stable URL.
- **[Person 3]** Confirm full multilingual coverage: 3+ Indian languages working end-to-end via voice + text + photo, with language auto-detection. → **EOD:** 3+ languages demoable across all input modes.
- **[Person 1]** Finalize citizen intake modes + dashboard polish; confirm Indian scripts render correctly; deploy both frontends at stable URLs (**the final prototype link**) and add basic auth on the MP dashboard. → **EOD:** the **real deployed prototype link works end-to-end from a fresh browser**.

**✅ Day 4 milestone:** Whole system deployed, running on realistic multilingual data, all modes working, rankings defensible.

---

### 🗓️ Day 5 — Sun, Jul 5 · Hardening + the "deployability" story
**Goal:** Make it robust and make the "can run in a real constituency in weeks" case concrete (that's **25%** of the score).

- **[Person 1]** Bug-bash the deployed app across devices/browsers; add logging + error/failure states; ensure it works on low-end Android + poor connectivity; make sure cold starts / rate limits won't kill a live demo. → **EOD:** deployed app survives 3 full run-throughs with zero manual fixes.
- **[Person 2]** Pipeline reliability: make `/submit` idempotent (dedupe), handle bad geo + missing fields; write `/docs/deployment.md` (which real datasets plug in, how a new constituency onboards, how pgvector scales). → **EOD:** pipeline is idempotent + onboarding documented.
- **[Person 4]** Trust features: per-priority **supporting evidence** (n citizens, which datasets, sample multilingual quotes) + guardrails so scoring/RAG never fabricates a location or number, and clustering never merges unrelated needs. → **EOD:** every ranked item is fully traceable to source submissions + data.
- **[Person 3]** Multilingual + inclusivity pass (**15%**): voice-first / low-literacy flow, confirmed language coverage, translation-quality spot-check (native-speaker sanity check if possible). → **EOD:** inclusivity + multilingual checklist met and demoable.

**✅ Day 5 milestone:** Robust, explainable, accessible, multilingual; deployability story documented and true.

---

### 🗓️ Day 6 — Mon, Jul 6 · Freeze, polish, repo, dry run
**Goal:** Feature freeze. Repo becomes submission-grade.

- **[All]** **Feature freeze at midday.** Afternoon = bug fixes, polish, docs only. No new features.
- **[Person 1]** Final frontend production deploy from `main`; verify the deployed link is stable and public/access-granted. Document a clean, repeatable step-by-step demo path (hands the *separate* video team a clean run to capture). → **EOD:** final deployed URL locked + demo path documented.
- **[Person 2 + Person 4]** Repo readiness: clean README (what it is, architecture diagram, setup incl. Cloud SQL + pgvector, env vars, which Google tech is used where), remove all secrets, add a seed script + mock data + public-data loaders, make it reproducible. → **EOD:** a stranger could clone and run it from the README alone.
- **[All]** Full dry run of the demo storyline together; log every bug; fix all P0/P1s. → **EOD:** two consecutive clean end-to-end runs.

**✅ Day 6 milestone:** Feature-frozen, deployed, repo clean and reproducible, demo path rock-solid.

---

### 🗓️ Day 7 — Tue, Jul 7 (until NOON) · Final checks + submit
**Goal:** Submit the two in-scope items — **source code + deployed link** — with buffer. Aim to finish by ~10:30.

- **[Person 1]** 08:00–09:00 — Final smoke test of the deployed prototype from a clean device/network; confirm the URL is live and shareable.
- **[Person 2]** 08:00–09:30 — Final repo pass: tag a release, confirm README + judge access (public or access-granted), confirm **no secrets committed**, confirm backend is live.
- **[Person 3]** 09:00–10:00 — Sanity-check AI + multilingual outputs on the live app (transcription, translation, categories still correct).
- **[Person 4]** 09:00–10:00 — Sanity-check that rankings + supporting evidence render correctly on live data.
- **[All]** 10:00–11:00 — **Submit** the source code repo link + deployed prototype link in the portal. Screenshot the confirmation. Hold buffer until noon for anything that breaks.

**🏁 FINAL (by 12:00 PM):** Source code + deployed prototype link **submitted and confirmed.**

---

## Critical Notes & Risk Buffers

- **Person 2 (Backend) is the critical path.** Everyone integrates through the API + database. If Person 2's Day 3 wiring slips, the whole team slips — protect it and pair up on Day 3 if needed.
- **The Person 3 → Person 4 intelligence chain is where the 25% "AI does real work" score is won.** Enrichment feeds embeddings, RAG, and scoring; if that chain is weak the demo looks decorative. Pair them and keep every ranked item traceable to real submissions + data.
- **Person 1 (Frontend) is the heaviest single role** — two frontends + Maps/Mapbox + hosting + demo path. If Person 1 falls behind, pull in Person 4 (knows the data shape) or Person 2 (knows the API) to help wire the dashboard.
- **Contracts on Day 1 are non-negotiable.** They're the only reason four people can build in parallel without constant collisions.
- **pgvector tips:** pick an index (HNSW or IVFFlat) early, and **embed the English-normalized text, not the raw text**, so multilingual submissions about the same issue cluster together instead of fragmenting by language.
- **Multilingual is a scored, must-have feature** (see the multilingual section). Keep the **original + translation** visible everywhere for evidence and trust — that's also what wins over a non-technical MP's office.
- **WhatsApp is out of the build scope — on purpose.** The deployed web app (text/voice/photo) is what the required "deployed prototype link" expects. Messaging intake is the deck's production-scaling story (zero build time). *Optional stretch only if the whole system is solid ahead of schedule:* a thin WhatsApp/Twilio sandbox as a bonus input mode feeding the same backend — but no build day is allocated to it and the plan must never depend on it.
- **Keep scope to ONE constituency.** Depth on one place scores better on the 25% deployability criterion than shallow coverage of many.
- **Out of scope but enabled:** the Day 6 documented demo path + the README/architecture give the video + deck team everything they need to work in parallel.