from __future__ import annotations

from typing import Any

from ingestion.config import Settings
from ingestion.models import (
    CATEGORIES,
    SENTIMENTS,
    URGENCY_LEVELS,
    EnrichedSubmission,
    PhotoAnalysis,
    RawSubmission,
)
from ingestion.providers import (
    GeminiEnrichmentProvider,
    GeminiPhotoProvider,
    OfflineHeuristicEnrichmentProvider,
    OfflinePhotoProvider,
    OfflineSpeechProvider,
    PhotoProvider,
    SpeechProvider,
    SpeechToTextV2Provider,
    TextEnrichmentProvider,
)


class IngestionService:
    def __init__(
        self,
        text_provider: TextEnrichmentProvider,
        speech_provider: SpeechProvider,
        photo_provider: PhotoProvider,
    ):
        self._text_provider = text_provider
        self._speech_provider = speech_provider
        self._photo_provider = photo_provider

    def enrich(self, submission: RawSubmission) -> EnrichedSubmission:
        source_modalities = self._source_modalities(submission)
        transcript = None
        transcript_language = None
        transcript_confidence = None
        provider_metadata: dict[str, Any] = {
            "text_provider": self._text_provider.name,
            "speech_provider": self._speech_provider.name,
            "photo_provider": self._photo_provider.name,
        }

        text_for_ai = submission.raw_text
        if not text_for_ai and submission.audio_url:
            transcript_result = self._speech_provider.transcribe(submission.audio_url, submission.language)
            transcript = transcript_result.text
            transcript_language = transcript_result.detected_language
            transcript_confidence = transcript_result.confidence
            provider_metadata["speech"] = transcript_result.provider_metadata
            text_for_ai = transcript

        photo = None
        if submission.photo_url:
            photo = self._photo_provider.analyze_photo(submission.photo_url, submission.language)
            provider_metadata["photo"] = photo.provider_metadata

        if not text_for_ai and photo:
            text_for_ai = photo.description or "Citizen submitted a civic issue photo for review."

        structured = self._text_provider.structure_submission(
            text_for_ai or "",
            language_hint=submission.language or transcript_language,
            photo=photo,
        )

        normalized_text = _required_text(structured.get("normalized_text_en"))
        quality_flags = _list_of_strings(structured.get("quality_flags"))
        if not normalized_text:
            normalized_text = "Citizen submitted a civic issue that needs review."
            quality_flags.append("missing_normalized_text")

        detected_language = (
            _optional_string(structured.get("detected_language"))
            or transcript_language
            or submission.language
        )

        confidence = _bounded_float(structured.get("confidence"), default=0.5)
        if transcript_confidence is not None:
            confidence = round((confidence + transcript_confidence) / 2, 3)
        if photo and photo.confidence is not None:
            confidence = round((confidence + photo.confidence) / 2, 3)

        extracted_entities = _entities_list(structured.get("extracted_entities"))
        if photo:
            extracted_entities = sorted(set(extracted_entities + photo.tags))
        canonical_location = _optional_string(structured.get("canonical_location")) or _geo_label(submission)
        if canonical_location:
            extracted_entities = sorted(set(extracted_entities + [canonical_location]))

        return EnrichedSubmission(
            id=submission.id,
            timestamp=submission.timestamp,
            channel=submission.channel,
            raw_text=submission.raw_text,
            audio_url=submission.audio_url,
            photo_url=submission.photo_url,
            language=_language_name(detected_language or submission.language),
            geo=submission.geo,
            citizen_id_hash=submission.citizen_id_hash,
            normalized_text_en=normalized_text,
            transcript=transcript,
            detected_language=detected_language,
            category=_category(structured.get("category")),
            need_type=_optional_string(structured.get("need_type")) or "Unknown",
            urgency=_urgency(structured.get("urgency")),
            sentiment=_sentiment(structured.get("sentiment")),
            canonical_location=canonical_location,
            extracted_entities=extracted_entities,
            confidence=confidence,
            quality_flags=sorted(set(quality_flags)),
            source_modalities=source_modalities,
            provider_metadata=provider_metadata,
        )

    def _source_modalities(self, submission: RawSubmission) -> list[str]:
        modalities = []
        if submission.raw_text:
            modalities.append("text")
        if submission.audio_url:
            modalities.append("audio")
        if submission.photo_url:
            modalities.append("photo")
        return modalities


def build_service(settings: Settings) -> IngestionService:
    if settings.provider == "google":
        return IngestionService(
            text_provider=GeminiEnrichmentProvider(settings),
            speech_provider=SpeechToTextV2Provider(settings),
            photo_provider=GeminiPhotoProvider(settings),
        )

    return IngestionService(
        text_provider=OfflineHeuristicEnrichmentProvider(),
        speech_provider=OfflineSpeechProvider(),
        photo_provider=OfflinePhotoProvider(),
    )


def _required_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _dict_or_empty(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list_of_strings(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if item is not None and str(item).strip()]


def _allowed(value: Any, allowed: set[str], default: str) -> str:
    text = _optional_string(value)
    if not text:
        return default
    normalized = text.lower().strip()
    return normalized if normalized in allowed else default


def _category(value: Any) -> str:
    text = _optional_string(value)
    if not text:
        return "PWD"
    if text in CATEGORIES:
        return text
    aliases = {
        "roads": "Mobility - Roads, Footpaths and Infrastructure",
        "road": "Mobility - Roads, Footpaths and Infrastructure",
        "mobility": "Mobility - Roads, Footpaths and Infrastructure",
        "sanitation": "Sanitation",
        "garbage": "Garbage and Unsanitary Practices",
        "waste": "Garbage and Unsanitary Practices",
        "water": "Water Supply and Services",
        "streetlight": "Streetlights",
        "streetlights": "Streetlights",
        "electricity": "Electricity and Power Supply",
        "power": "Electricity and Power Supply",
        "traffic": "Traffic and Road Safety",
        "transport": "Traffic and Road Safety",
        "safety": "Crime and Safety",
        "public_safety": "Crime and Safety",
        "healthcare": "PWD",
        "education": "PWD",
        "other": "PWD",
    }
    return aliases.get(text.lower().strip(), "PWD")


def _urgency(value: Any) -> str:
    text = (_optional_string(value) or "Medium").capitalize()
    return text if text in URGENCY_LEVELS else "Medium"


def _sentiment(value: Any) -> str:
    text = _optional_string(value)
    if not text:
        return "Neutral"
    normalized = text.capitalize()
    return normalized if normalized in SENTIMENTS else text


def _entities_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return sorted(set(str(item).strip() for item in value if str(item).strip()))
    if isinstance(value, dict):
        flattened: list[str] = []
        for item in value.values():
            if isinstance(item, list):
                flattened.extend(str(child).strip() for child in item if str(child).strip())
            elif item is not None and str(item).strip():
                flattened.append(str(item).strip())
        return sorted(set(flattened))
    return []


def _language_name(value: str | None) -> str | None:
    if not value:
        return None
    aliases = {
        "hi": "Hindi",
        "hi-IN": "Hindi",
        "hi-Latn": "Hindi",
        "kn": "Kannada",
        "kn-IN": "Kannada",
        "te": "Telugu",
        "te-IN": "Telugu",
        "ta": "Tamil",
        "ta-IN": "Tamil",
        "bn": "Bengali",
        "bn-IN": "Bengali",
        "mr": "Marathi",
        "mr-IN": "Marathi",
        "en": "English",
        "en-IN": "English",
    }
    return aliases.get(value, value)


def _bounded_float(value: Any, default: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = default
    return round(max(0.0, min(1.0, number)), 3)


def _geo_label(submission: RawSubmission) -> str | None:
    if not submission.geo:
        return None
    if submission.geo.ward:
        return submission.geo.ward
    if submission.geo.address:
        return submission.geo.address
    if submission.geo.lat is not None and submission.geo.lng is not None:
        return f"{submission.geo.lat:.5f},{submission.geo.lng:.5f}"
    return None
