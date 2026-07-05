# Person 3 Ingestion Service

This service turns raw citizen text, voice, and photo submissions into the enriched shape used by the current repo.

It supports two modes:

- `INGESTION_PROVIDER=offline`: deterministic local demo mode, no credentials needed.
- `INGESTION_PROVIDER=google`: Gemini + Cloud Speech-to-Text V2 adapters.

## Local Demo

```bash
python3 -m ingestion.cli --demo
```

## Tests

From the repo root:

```bash
python3 -m unittest discover -s services/ingestion/tests -v
```

## API

```bash
pip install -r services/ingestion/requirements.txt
uvicorn app:app --app-dir services/ingestion --reload --port 8080
```

Main endpoints:

- `GET /health`
- `POST /enrich`
- `POST /batch-enrich`

