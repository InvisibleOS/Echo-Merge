# Constituency Intelligence & Action OS

This branch turns the app into a hackathon-ready operating system for constituency action, not just a complaint portal.

## What It Does

- Citizens submit issues through text, voice, or photo.
- The backend enriches the report, routes it to a department, recommends schemes, and creates a case.
- MPs/MLAs see a live command center with constituency health, hotspots, priorities, cases, SLA risk, department workload, budget recommendations, and an AI Copilot.
- Department officials get an assigned work queue.
- Citizens and the public can track case status through the transparency pages.

## Google AI Usage

The platform uses Gemini when keys are configured:

- `lib/server/enrichment.js` uses Gemini for translation, entity extraction, department-ready issue classification, urgency, and location extraction.
- `lib/server/embedding.js` uses Gemini embeddings for semantic clustering/search when available.
- `lib/server/action-os.js` uses Gemini for the MP Copilot answers, grounded in live constituency data.

If keys are missing or calls fail, deterministic offline fallbacks keep the demo fully runnable.

Required optional env vars:

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

- `/submit` for citizen reporting
- `/dashboard` for MP command center
- `/department` for department queue
- `/transparency` for public tracker

Offline API smoke test:

```bash
curl -X POST http://localhost:3000/api/submit \
  -H "Content-Type: application/json" \
  -d '{"raw_text":"School ke paas streetlight nahi jal rahi hai","language":"hi","geo":{"ward":"Bengaluru South","lat":12.91,"lng":77.59},"channel":"web"}'
```

Copilot:

```bash
curl -X POST http://localhost:3000/api/copilot \
  -H "Content-Type: application/json" \
  -d '{"question":"Which department has SLA risk?","constituency":"Bengaluru South"}'
```

## Demo Script

1. Start at `/`.
2. Open `/submit`.
3. Submit a Hindi/Hinglish streetlight issue.
4. Show instant tracking ID, routed department, SLA, and scheme guidance.
5. Open `/dashboard`.
6. Show constituency health, hotspot map, live priority, action queue, department workload, budget recommendations, and Copilot.
7. Ask Copilot: "Which department has SLA risk?"
8. Assign or resolve a case from the Action Queue.
9. Open `/department` to show official work queue.
10. Open `/transparency` to show public trust/status layer.

