# API & Data Contracts (FROZEN — Day 1)

> This is the single source of truth for the seams between all four roles.
> Person 2 (Backend) owns this file. The frontend's TypeScript mirror lives in
> [`lib/types.ts`](../lib/types.ts) and **must stay in sync** — if the backend
> response ever diverges from this doc, it's a contract break: flag it in
> standup, don't silently patch around it.
>
> **Constituency:** Bengaluru South.  **Demo languages:** Hindi, Kannada,
> Tamil, English (+ Telugu/Bengali/Marathi supported by the same pipeline).

---

## 1. Data schemas

### `Submission` (raw — what the citizen app sends)
| field | type | notes |
|---|---|---|
| `id` | uuid | server-generated |
| `timestamp` | ISO-8601 string | server-generated |
| `channel` | `"web" \| "whatsapp"` | defaults `"web"`; `whatsapp` reserved, not built |
| `raw_text` | string? | original-language text |
| `audio_url` | string? | stored voice note |
| `photo_url` | string? | stored photo |
| `language` | string | BCP-47 code from the form (`hi`,`kn`,`ta`,`en`) |
| `geo` | `{lat,lng}` or `{ward}` | may be absent |
| `citizen_id_hash` | string | anonymised citizen id |

### `EnrichedSubmission` (post-AI — Person 3's output, `Submission` + …)
| field | type | notes |
|---|---|---|
| `normalized_text_en` | string | English canonical (original always preserved) |
| `category` | string | free-text; 12 known values, see `KNOWN_CATEGORIES` |
| `need_type` | string | |
| `urgency` | `"Critical"\|"High"\|"Medium"\|"Low"` | capitalised |
| `sentiment` | string? | |
| `canonical_location` | string? | may be the literal `"nan"` → treat as absent |
| `extracted_entities` | string[] | |

> Note: Person 3's pipeline emits `language` as a full word ("Hindi", "Tamil")
> by the enriched stage, while the intake form sends BCP-47 codes. Both stages
> are valid; don't assume one format across the whole pipeline.

### `Embedding` (pgvector)
`{ submission_id: uuid, vector: float[768] }` — embedding is generated on
`normalized_text_en` (NOT `raw_text`), so cross-language duplicates cluster.

### `PriorityItem` (dashboard-facing — Person 4's scoring output)
| field | type | notes |
|---|---|---|
| `work_id` | string | |
| `title` | string | |
| `category` | string | |
| `demand_score` | number | **0–100 scale** (revised from 0–1 on 2026-07-03) |
| `demand_count` | number | # citizens/submissions behind it |
| `hotspot_geo` | `{lat,lng}` (+ optional `ward`) | centroid |
| `supporting_evidence` | `SupportingEvidence[]` | see below |
| `rank` | number | 1 = highest |
| `explanation` | string | human-readable "why this rank" |

`SupportingEvidence` = `{ submission_id, raw_text, normalized_text_en, language }`.

### `Hotspot` (map aggregation)
`{ geo: {lat,lng}, intensity: number /*0–1*/, category: string, demand_count: number }`

---

## 2. HTTP API

**Served under `/api/*`.** Set `NEXT_PUBLIC_API_BASE_URL` to `<origin>/api`
(e.g. `http://localhost:3000/api`), so the frontend's logical paths below
resolve to the real handlers. We do **not** serve the API at bare `/submit`
because that route is the citizen submission *page* (`app/submit/page.tsx`) —
serving JSON there would collide with the page. Logical `/submit` ⇒ `/api/submit`.

| method | logical path | served at | owner→caller | request | response |
|---|---|---|---|---|---|
| `POST` | `/submit` | `/api/submit` | Person 1 → 2 | `SubmitPayload` | `SubmitResponse` |
| `GET` | `/submissions` | `/api/submissions` | 2 → 1 | `?work_id=` optional | `EnrichedSubmission[]` |
| `GET` | `/priorities` | `/api/priorities` | 2 → 1 | `?sortBy=rank\|demand_score` | `PriorityItem[]` |
| `GET` | `/hotspots` | `/api/hotspots` | 2 → 1 | — | `Hotspot[]` |
| `POST` | `/api/internal/similar` | `/api/internal/similar` | 2 → 4 (RAG) | `{ text? , vector?, k?, threshold? }` | `{ matches: {submission_id, similarity}[] }` |

`SubmitPayload` = `{ raw_text?, audio_base64?, photo_base64?, audio_url?, photo_url?, language, geo?, channel?, citizen_id_hash? }`
— at least one of text/audio/photo is required. The citizen form sends media as
**raw base64** (`audio_base64`/`photo_base64`); the backend persists it to a URL
(Supabase Storage if `SUPABASE_MEDIA_BUCKET` is set, else an inline `data:` URI)
and stores `audio_url`/`photo_url`. `channel` defaults to `"web"`;
`citizen_id_hash` falls back to an anonymous derived id.

`SubmitResponse` = `{ success: boolean, submission_id: string, message: string }`.

**Conventions**
- All list endpoints return a **bare JSON array** (not `{data:[…]}`).
- Errors return `{ error: string }` with an appropriate 4xx/5xx status.
- `GET /priorities` and `GET /hotspots` are cached ~20s server-side and
  invalidated when a new submission is processed.
- `POST /submit` is **idempotent**: re-posting identical content from the same
  citizen returns the original `submission_id` (`success:true`, deduped message)
  instead of creating a duplicate.
