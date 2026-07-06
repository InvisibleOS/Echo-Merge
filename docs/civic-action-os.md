# MP Command Center and Department Portal

This branch is intentionally scoped to the pieces requested on top of the latest
`main` branch:

- MP Command Center dashboard enhancements
- Department Portal
- Case/action queue APIs needed by those two surfaces
- Google AI support for enrichment and embeddings where credentials are present
- Offline deterministic fallbacks so the demo still runs without secrets

## What Was Added

### MP Command Center

Route: `/dashboard`

Adds:

- Constituency health cards
- Open case count
- SLA risk
- Trust score
- Hotspot count
- Ranked priorities
- Department-routed action queue
- Department workload analytics
- Weekly governance brief
- Priority drill-down with resolution brief, department routing, budget fit, and supporting evidence

### Department Portal

Route: `/department`

Adds:

- Department workload summary
- SLA compliance
- Active case queue
- Case ownership
- Recommended first action for officials

## APIs Added

- `GET /api/cases`
- `PATCH /api/cases/:id`
- `GET /api/dashboard/health`
- `GET /api/dashboard/departments`
- `GET /api/dashboard/insights`
- `GET /api/department/cases`

Existing latest-main APIs and behavior are preserved, including category filters
and priority resolution.

## Google AI Usage

When keys are configured, the platform uses Google AI for:

- Gemini enrichment in `lib/server/enrichment.js`
- Gemini embeddings in `lib/server/embedding.js`

If keys are missing or calls fail, deterministic offline fallbacks keep the
dashboard and department portal runnable.

Relevant env vars:

```bash
GEMINI_API_KEY=
GOOGLE_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

## Local Demo

```bash
npm install
npm run dev
```

Open:

- `/dashboard`
- `/department`

Optional offline submit test:

```bash
curl -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"raw_text":"School ke paas streetlight nahi jal rahi hai","language":"hi","geo":{"ward":"Bengaluru South","lat":12.91,"lng":77.59},"channel":"web"}'
```

