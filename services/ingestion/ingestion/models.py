from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


CATEGORIES = {
    "Mobility - Roads, Footpaths and Infrastructure",
    "Water Supply and Services",
    "Garbage and Unsanitary Practices",
    "Pollution",
    "Traffic and Road Safety",
    "PWD",
    "Streetlights",
    "Sanitation",
    "Electricity and Power Supply",
    "Crime and Safety",
    "Animal Husbandry",
    "Yellow Spot",
}

URGENCY_LEVELS = {"Low", "Medium", "High", "Critical"}
SENTIMENTS = {"Positive", "Neutral", "Anxious", "Frustrated", "Angry", "Concerned", "Mixed"}


class ValidationError(ValueError):
    """Raised when a request cannot be safely turned into a submission."""


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class Geo:
    lat: float | None = None
    lng: float | None = None
    ward: str | None = None
    address: str | None = None

    @classmethod
    def from_mapping(cls, data: Any) -> "Geo | None":
        if data is None:
            return None
        if not isinstance(data, dict):
            raise ValidationError("geo must be an object")
        return cls(
            lat=_optional_float(data.get("lat")),
            lng=_optional_float(data.get("lng")),
            ward=_optional_str(data.get("ward")),
            address=_optional_str(data.get("address")),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            key: value
            for key, value in {
                "lat": self.lat,
                "lng": self.lng,
                "ward": self.ward,
                "address": self.address,
            }.items()
            if value is not None
        }


@dataclass(frozen=True)
class RawSubmission:
    id: str
    timestamp: str = field(default_factory=utc_now_iso)
    channel: str = "web"
    raw_text: str | None = None
    audio_url: str | None = None
    photo_url: str | None = None
    language: str | None = None
    geo: Geo | None = None
    citizen_id_hash: str | None = None

    @classmethod
    def from_mapping(cls, data: dict[str, Any]) -> "RawSubmission":
        if not isinstance(data, dict):
            raise ValidationError("submission must be an object")

        submission_id = _optional_str(data.get("id"))
        if not submission_id:
            raise ValidationError("submission id is required")

        raw_text = _optional_str(data.get("raw_text"))
        audio_url = _optional_str(data.get("audio_url"))
        photo_url = _optional_str(data.get("photo_url"))
        if not any([raw_text, audio_url, photo_url]):
            raise ValidationError("at least one of raw_text, audio_url, or photo_url is required")

        return cls(
            id=submission_id,
            timestamp=_optional_str(data.get("timestamp")) or utc_now_iso(),
            channel=_optional_str(data.get("channel")) or "web",
            raw_text=raw_text,
            audio_url=audio_url,
            photo_url=photo_url,
            language=_optional_str(data.get("language")),
            geo=Geo.from_mapping(data.get("geo")),
            citizen_id_hash=_optional_str(data.get("citizen_id_hash")),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            key: value
            for key, value in {
                "id": self.id,
                "timestamp": self.timestamp,
                "channel": self.channel,
                "raw_text": self.raw_text,
                "audio_url": self.audio_url,
                "photo_url": self.photo_url,
                "language": self.language,
                "geo": self.geo.to_dict() if self.geo else None,
                "citizen_id_hash": self.citizen_id_hash,
            }.items()
            if value is not None
        }


@dataclass(frozen=True)
class TranscriptResult:
    text: str
    detected_language: str | None = None
    confidence: float | None = None
    provider_metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class PhotoAnalysis:
    tags: list[str] = field(default_factory=list)
    description: str | None = None
    confidence: float | None = None
    provider_metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class EnrichedSubmission(RawSubmission):
    normalized_text_en: str = ""
    transcript: str | None = None
    detected_language: str | None = None
    category: str = "PWD"
    need_type: str = "Unknown"
    urgency: str = "Medium"
    sentiment: str = "Neutral"
    canonical_location: str | None = None
    extracted_entities: list[str] = field(default_factory=list)
    confidence: float = 0.0
    quality_flags: list[str] = field(default_factory=list)
    source_modalities: list[str] = field(default_factory=list)
    validation_context: str | None = None
    provider_metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        base = super().to_dict()
        base.update(
            {
                "normalized_text_en": self.normalized_text_en,
                "transcript": self.transcript,
                "detected_language": self.detected_language,
                "category": self.category,
                "need_type": self.need_type,
                "urgency": self.urgency,
                "sentiment": self.sentiment,
                "canonical_location": self.canonical_location,
                "extracted_entities": self.extracted_entities,
                "confidence": self.confidence,
                "quality_flags": self.quality_flags,
                "source_modalities": self.source_modalities,
                "validation_context": self.validation_context,
                "provider_metadata": self.provider_metadata,
            }
        )
        return {key: value for key, value in base.items() if value is not None}


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return str(value).strip() or None


def _optional_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"expected a number, got {value!r}") from exc
