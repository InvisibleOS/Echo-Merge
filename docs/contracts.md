# API and Data Contracts

These contracts freeze the Person 3 handoff so frontend, backend, and data logic can work in parallel.

## Raw Submission

```json
{
  "id": "sub_001",
  "timestamp": "2026-07-05T15:30:00Z",
  "channel": "web",
  "raw_text": "हमारे वार्ड में सड़क टूट गई है",
  "audio_url": "gs://bucket/audio/sub_001.webm",
  "photo_url": "gs://bucket/photos/sub_001.jpg",
  "language": "hi-IN",
  "geo": {
    "lat": 28.6139,
    "lng": 77.209,
    "ward": "Ward 12"
  },
  "citizen_id_hash": "sha256:..."
}
```

Only one of `raw_text`, `audio_url`, or `photo_url` is required, but multiple modalities may be present.

## Enriched Submission

Person 3 returns the raw submission plus:

```json
{
  "normalized_text_en": "The road in Ward 12 is broken and needs urgent repair.",
  "transcript": "हमारे वार्ड में सड़क टूट गई है",
  "detected_language": "hi-IN",
  "category": "Mobility - Roads, Footpaths and Infrastructure",
  "need_type": "Public Maintenance",
  "urgency": "High",
  "sentiment": "Concerned",
  "canonical_location": "Ward 12",
  "extracted_entities": ["Ward 12", "broken_road", "infrastructure"],
  "confidence": 0.84,
  "quality_flags": [],
  "source_modalities": ["text", "photo"],
  "provider_metadata": {
    "text_provider": "gemini",
    "speech_provider": "cloud_speech_v2"
  }
}
```

Allowed categories, matching the current frontend and Data_Logic code:

- `Mobility - Roads, Footpaths and Infrastructure`
- `Water Supply and Services`
- `Garbage and Unsanitary Practices`
- `Pollution`
- `Traffic and Road Safety`
- `PWD`
- `Streetlights`
- `Sanitation`
- `Electricity and Power Supply`
- `Crime and Safety`
- `Animal Husbandry`
- `Yellow Spot`

Allowed urgency values:

- `Low`
- `Medium`
- `High`
- `Critical`

Common sentiment values:

- `Positive`
- `Neutral`
- `Anxious`
- `Frustrated`
- `Angry`
- `Concerned`
- `Mixed`

## Person 3 Service Endpoints

### `POST /enrich`

Input: `RawSubmission`

Output: `EnrichedSubmission`

Used by Person 2 immediately after `POST /submit` persists the raw submission.

### `POST /batch-enrich`

Input:

```json
{
  "submissions": []
}
```

Output:

```json
{
  "items": []
}
```

Used for seed data, demo resets, and backfills.

### `GET /health`

Output:

```json
{
  "status": "ok",
  "provider": "offline",
  "version": "0.1.0"
}
```

Used by Cloud Run health checks and Person 2 integration tests.

## Backend Pipeline Handoff

1. Person 2 stores `RawSubmission`.
2. Person 2 calls `POST /enrich`.
3. Person 2 stores the returned `EnrichedSubmission`.
4. Person 4 embeds `normalized_text_en` into pgvector.
5. Person 4 uses `category`, `need_type`, `canonical_location`, and `extracted_entities` for clustering and scoring.
