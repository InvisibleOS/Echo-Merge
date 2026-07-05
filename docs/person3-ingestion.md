# Person 3 AI/Ingestion Handoff

You own the first intelligence layer: turning citizen input into clean, multilingual, structured data.

## What Is Done

- Text submissions in Indian languages normalize into English.
- Voice submissions have a Cloud Speech-to-Text V2 adapter and an offline demo adapter.
- Photo submissions get issue tags and can be included in Gemini multimodal prompts.
- Every submission returns the current repo `EnrichedSubmission` shape from `lib/types.ts`.
- Local tests run without GCP credentials.
- Person 2 can call a single `/enrich` endpoint from the backend pipeline.

## Local Demo

```bash
cd services/ingestion
python -m ingestion.cli --demo
```

This prints multilingual enriched examples for Hindi, Telugu, Tamil, Bengali, Marathi, Hinglish, and English.

Single text example:

```bash
cd services/ingestion
python -m ingestion.cli --text "मोहल्ले में कचरा नहीं उठ रहा है" --language hi-IN
```

Voice demo without cloud:

```bash
cd services/ingestion
python -m ingestion.cli --audio-url demo://hindi-road --language hi-IN
```

Photo demo without cloud:

```bash
cd services/ingestion
python -m ingestion.cli --photo-url demo://garbage-dump --language en-IN
```

## API Demo

```bash
cd services/ingestion
pip install -r requirements.txt
uvicorn app:app --reload --port 8080
```

```bash
curl -X POST http://localhost:8080/enrich \
  -H "Content-Type: application/json" \
  -d '{"id":"demo-1","raw_text":"School ke paas streetlight nahi jal rahi","language":"hi-Latn","geo":{"ward":"Ward 7"}}'
```

## Cloud Setup

Set these environment variables when GCP is ready:

```bash
export INGESTION_PROVIDER=google
export GOOGLE_CLOUD_PROJECT=your-gcp-project
export GOOGLE_CLOUD_LOCATION=us-central1
export GEMINI_MODEL=gemini-1.5-flash
export SPEECH_RECOGNIZER=_
```

Install dependencies:

```bash
cd services/ingestion
pip install -r requirements.txt
```

Authenticate locally:

```bash
gcloud auth application-default login
```

Cloud Run will use the service account attached to the service.

## Cloud Run Build

```bash
cd services/ingestion
gcloud run deploy person3-ingestion \
  --source . \
  --region us-central1 \
  --set-env-vars INGESTION_PROVIDER=google,GOOGLE_CLOUD_PROJECT=your-gcp-project,GOOGLE_CLOUD_LOCATION=us-central1,GEMINI_MODEL=gemini-1.5-flash,SPEECH_RECOGNIZER=_
```

## Demo Checklist

Use these as the final Day 7 sanity checks:

- Hindi text about a broken road returns `category=Mobility - Roads, Footpaths and Infrastructure`, `urgency=High`, and good English text.
- Telugu text about drinking water returns `category=Water Supply and Services`.
- Tamil text about garbage returns `category=Garbage and Unsanitary Practices`.
- Hinglish text about a streetlight returns `category=Streetlights`.
- A `demo://hindi-road` voice submission returns a transcript and enriched JSON.
- A garbage or road photo URI adds `photo_tags`.
- `raw_text` or `transcript` is preserved for dashboard evidence.
- `normalized_text_en` is always non-empty before Person 4 embeds it.
- `extracted_entities` is an array, matching Person 4's current local pipeline.

## Person 2 Integration

Call `POST /enrich` after storing the raw submission. Store the whole response in the enriched submissions table. Person 4 should embed only `normalized_text_en`, not `raw_text`.

If `/enrich` returns `quality_flags`, keep the record but surface the flags in logs. The service is designed to be permissive for demos: it returns best-effort structured data instead of dropping citizen submissions.
