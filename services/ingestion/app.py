from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException

from ingestion.config import load_settings
from ingestion.models import RawSubmission, ValidationError
from ingestion.service import build_service

settings = load_settings()
service = build_service(settings)

app = FastAPI(
    title="Person 3 AI/Ingestion Service",
    version="0.1.0",
    description="Multilingual transcription, translation, photo tagging, and structured enrichment.",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "provider": settings.provider,
        "version": "0.1.0",
    }


@app.post("/enrich")
def enrich(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        submission = RawSubmission.from_mapping(payload)
        return service.enrich(submission).to_dict()
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"enrichment failed: {exc}") from exc


@app.post("/batch-enrich")
def batch_enrich(payload: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    submissions = payload.get("submissions")
    if not isinstance(submissions, list):
        raise HTTPException(status_code=422, detail="Expected {'submissions': [...]} body")

    items: list[dict[str, Any]] = []
    for raw in submissions:
        try:
            submission = RawSubmission.from_mapping(raw)
            items.append(service.enrich(submission).to_dict())
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"items": items}

