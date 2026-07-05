from __future__ import annotations

import json
import mimetypes
import re
from pathlib import Path
from typing import Any, Protocol

from ingestion.config import DEFAULT_LANGUAGE_CODES, Settings
from ingestion.models import PhotoAnalysis, TranscriptResult
from ingestion.prompts import ENRICHMENT_SYSTEM_PROMPT, build_text_prompt


class TextEnrichmentProvider(Protocol):
    name: str

    def structure_submission(
        self,
        text: str,
        language_hint: str | None = None,
        photo: PhotoAnalysis | None = None,
    ) -> dict[str, Any]:
        ...


class SpeechProvider(Protocol):
    name: str

    def transcribe(self, audio_url: str, language_hint: str | None = None) -> TranscriptResult:
        ...


class PhotoProvider(Protocol):
    name: str

    def analyze_photo(self, photo_url: str, language_hint: str | None = None) -> PhotoAnalysis:
        ...


class OfflineSpeechProvider:
    name = "offline_speech_demo"

    _TRANSCRIPTS = {
        "demo://hindi-road": ("hi-IN", "हमारे वार्ड में सड़क टूट गई है और बारिश में पानी भर जाता है"),
        "demo://telugu-water": ("te-IN", "మా వీధిలో తాగునీరు మూడు రోజులుగా రావడం లేదు"),
        "demo://tamil-garbage": ("ta-IN", "எங்கள் பகுதியில் குப்பை எடுக்கவில்லை, துர்நாற்றம் வருகிறது"),
        "demo://hinglish-light": ("hi-Latn", "School ke paas streetlight nahi jal rahi hai"),
    }

    def transcribe(self, audio_url: str, language_hint: str | None = None) -> TranscriptResult:
        language, text = self._TRANSCRIPTS.get(
            audio_url,
            (language_hint or "en-IN", f"Demo transcript for audio file {audio_url}"),
        )
        return TranscriptResult(
            text=text,
            detected_language=language,
            confidence=0.91,
            provider_metadata={"audio_url": audio_url},
        )


class OfflinePhotoProvider:
    name = "offline_photo_demo"

    _TAG_RULES = {
        "road": ("broken_road", "Photo appears to show a damaged road surface."),
        "pothole": ("broken_road", "Photo appears to show potholes on a road."),
        "garbage": ("garbage_dump", "Photo appears to show uncollected garbage."),
        "dump": ("garbage_dump", "Photo appears to show uncollected garbage."),
        "water": ("water_logging", "Photo appears to show water logging or water supply issue."),
        "light": ("streetlight", "Photo appears to show a streetlight or dark public area."),
        "school": ("school_infrastructure", "Photo appears to show a school infrastructure issue."),
        "hospital": ("healthcare_facility", "Photo appears to show a healthcare facility issue."),
    }

    def analyze_photo(self, photo_url: str, language_hint: str | None = None) -> PhotoAnalysis:
        haystack = photo_url.lower()
        tags: list[str] = []
        descriptions: list[str] = []
        for keyword, (tag, description) in self._TAG_RULES.items():
            if keyword in haystack and tag not in tags:
                tags.append(tag)
                descriptions.append(description)

        if not tags:
            tags.append("civic_issue_photo")
            descriptions.append("Photo attached by citizen; issue requires manual review.")

        return PhotoAnalysis(
            tags=tags,
            description=" ".join(descriptions),
            confidence=0.72 if tags != ["civic_issue_photo"] else 0.45,
            provider_metadata={"photo_url": photo_url},
        )


class OfflineHeuristicEnrichmentProvider:
    name = "offline_heuristic_enrichment"

    _RULES = [
        (
            "Mobility - Roads, Footpaths and Infrastructure",
            ("road", "roads", "pothole", "सड़क", "రోడ్డు", "சாலை", "রাস্তা", "रस्ता"),
            "Public Maintenance",
            "Road repair or maintenance is needed.",
        ),
        (
            "Garbage and Unsanitary Practices",
            ("garbage", "waste", "trash", "dump", "कचरा", "చెత్త", "குப்பை", "আবর্জনা", "कचरा"),
            "Public Maintenance",
            "Garbage collection or sanitation service is needed.",
        ),
        (
            "Water Supply and Services",
            ("water", "drinking", "पानी", "जल", "నీరు", "தண்ணீர்", "জল", "পানি", "पाणी"),
            "Service Delivery",
            "Reliable water supply is needed.",
        ),
        (
            "Streetlights",
            ("streetlight", "street light", "மின்விளக்கு", "లైట్"),
            "Public Maintenance",
            "Streetlight or electricity repair is needed.",
        ),
        (
            "Electricity and Power Supply",
            ("electric", "power", "powercut", "power cut", "बिजली", "বিদ্যুৎ"),
            "Service Delivery",
            "Electricity or power supply service needs attention.",
        ),
        (
            "PWD",
            ("school", "teacher", "classroom", "स्कूल", "विद्यालय", "పాఠశాల", "பள்ளி", "স্কুল"),
            "New Asset",
            "School infrastructure or education support is needed.",
        ),
        (
            "PWD",
            (
                "hospital",
                "clinic",
                "doctor",
                "ambulance",
                "अस्पताल",
                "दवाखाना",
                "रुग्णालय",
                "ఆసుపత్రి",
                "மருத்துவமனை",
                "হাসপাতাল",
            ),
            "New Asset",
            "Healthcare access or facility support is needed.",
        ),
        (
            "Traffic and Road Safety",
            ("bus", "stop", "transport", "traffic", "speed breaker", "helmet", "parking", "बस", "బస్", "பஸ்", "বাস"),
            "Safety",
            "Traffic, transport, or road safety needs improvement.",
        ),
        (
            "Crime and Safety",
            ("safety", "crime", "unsafe", "danger", "सुरक्षा", "பாதுகாப்பு", "নিরাপত্তা"),
            "Safety",
            "Public safety issue needs attention.",
        ),
    ]

    _LOCATION_PATTERNS = (
        re.compile(r"\bward\s*(\d+[a-z]?)\b", re.IGNORECASE),
        re.compile(r"\bsector\s*(\d+[a-z]?)\b", re.IGNORECASE),
        re.compile(r"\bnear\s+([A-Za-z0-9 .'-]{3,40})", re.IGNORECASE),
    )

    def structure_submission(
        self,
        text: str,
        language_hint: str | None = None,
        photo: PhotoAnalysis | None = None,
    ) -> dict[str, Any]:
        category, need_type, normalized = self._classify(text, photo)
        urgency = self._urgency(text, category, photo)
        canonical_location = self._location(text)
        photo_tags = photo.tags if photo else []
        issues = [category] + photo_tags

        entities = self._entities_for(category, text, photo_tags, canonical_location)
        return {
            "normalized_text_en": self._normalized_summary(text, normalized, canonical_location, photo),
            "detected_language": language_hint or self._guess_language(text),
            "category": category,
            "need_type": need_type,
            "urgency": urgency,
            "sentiment": "Concerned" if need_type != "Unknown" else "Neutral",
            "canonical_location": canonical_location,
            "extracted_entities": entities,
            "confidence": 0.72 if need_type != "Unknown" else 0.42,
            "quality_flags": [] if need_type != "Unknown" else ["needs_human_review"],
        }

    def _classify(self, text: str, photo: PhotoAnalysis | None) -> tuple[str, str, str]:
        haystack = " ".join([text.lower(), " ".join(photo.tags if photo else [])])
        for category, keywords, need_type, normalized in self._RULES:
            if any(keyword.lower() in haystack for keyword in keywords):
                return category, need_type, normalized
        return "PWD", "Unknown", "Citizen reported a civic issue that needs review."

    def _urgency(self, text: str, category: str, photo: PhotoAnalysis | None) -> str:
        haystack = text.lower()
        if any(token in haystack for token in ("emergency", "danger", "accident", "unsafe", "बीमार", "खतरा")):
            return "Critical"
        if category in {
            "Mobility - Roads, Footpaths and Infrastructure",
            "Water Supply and Services",
            "Garbage and Unsanitary Practices",
            "Streetlights",
            "Electricity and Power Supply",
            "Crime and Safety",
        }:
            return "High"
        if photo and any(tag in photo.tags for tag in ("water_logging", "broken_road", "garbage_dump")):
            return "High"
        return "Medium"

    def _location(self, text: str) -> str | None:
        for pattern in self._LOCATION_PATTERNS:
            match = pattern.search(text)
            if not match:
                continue
            if "ward" in pattern.pattern:
                return f"Ward {match.group(1).upper()}"
            if "sector" in pattern.pattern:
                return f"Sector {match.group(1).upper()}"
            return f"near {match.group(1).strip()}"
        return None

    def _normalized_summary(
        self,
        text: str,
        normalized: str,
        canonical_location: str | None,
        photo: PhotoAnalysis | None,
    ) -> str:
        location = f" Location: {canonical_location}." if canonical_location else ""
        photo_context = f" Photo evidence: {photo.description}" if photo and photo.description else ""
        return f"{normalized}{location}{photo_context}".strip()

    def _guess_language(self, text: str) -> str:
        if re.search(r"[\u0900-\u097F]", text):
            return "hi-IN"
        if re.search(r"[\u0C00-\u0C7F]", text):
            return "te-IN"
        if re.search(r"[\u0B80-\u0BFF]", text):
            return "ta-IN"
        if re.search(r"[\u0980-\u09FF]", text):
            return "bn-IN"
        return "en-IN"

    def _entities_for(
        self,
        category: str,
        text: str,
        photo_tags: list[str],
        canonical_location: str | None,
    ) -> list[str]:
        entities = [category.lower()]
        entities.extend(photo_tags)
        if canonical_location:
            entities.append(canonical_location.lower())
        entities.extend(self._people_groups(text))
        if category == "Mobility - Roads, Footpaths and Infrastructure":
            entities.append("infrastructure")
        if category in {"Garbage and Unsanitary Practices", "Sanitation"}:
            entities.append("waste")
        if category == "Water Supply and Services":
            entities.append("water supply")
        if category == "Streetlights":
            entities.append("streetlight")
        if category == "Electricity and Power Supply":
            entities.append("power supply")
        return sorted(set(entities))

    def _people_groups(self, text: str) -> list[str]:
        haystack = text.lower()
        groups = []
        if any(token in haystack for token in ("children", "kids", "students", "बच्चे", "विद्यार्थी")):
            groups.append("children")
        if any(token in haystack for token in ("women", "महिला", "பெண்கள்")):
            groups.append("women")
        if any(token in haystack for token in ("elderly", "senior", "बुजुर्ग", "वृद्ध")):
            groups.append("elderly")
        return groups


class GeminiEnrichmentProvider:
    name = "gemini"

    def __init__(self, settings: Settings):
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            raise RuntimeError("google-genai is required for INGESTION_PROVIDER=google") from exc

        if not settings.google_cloud_project:
            raise RuntimeError("GOOGLE_CLOUD_PROJECT is required for INGESTION_PROVIDER=google")

        self._types = types
        self._model = settings.gemini_model
        self._client = genai.Client(
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.google_cloud_location,
        )

    def structure_submission(
        self,
        text: str,
        language_hint: str | None = None,
        photo: PhotoAnalysis | None = None,
    ) -> dict[str, Any]:
        prompt = build_text_prompt(text, language_hint, photo.description if photo else None)
        response = self._client.models.generate_content(
            model=self._model,
            contents=[ENRICHMENT_SYSTEM_PROMPT, prompt],
            config=self._types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        return parse_json_object(response.text)


class GeminiPhotoProvider:
    name = "gemini_photo"

    def __init__(self, settings: Settings):
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            raise RuntimeError("google-genai is required for INGESTION_PROVIDER=google") from exc

        if not settings.google_cloud_project:
            raise RuntimeError("GOOGLE_CLOUD_PROJECT is required for INGESTION_PROVIDER=google")

        self._types = types
        self._model = settings.gemini_model
        self._client = genai.Client(
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.google_cloud_location,
        )

    def analyze_photo(self, photo_url: str, language_hint: str | None = None) -> PhotoAnalysis:
        prompt = (
            "Analyze this citizen-submitted civic issue photo. Return only JSON with "
            '{"tags":[],"description":"...","confidence":0.0}. Use tags such as '
            "broken_road, garbage_dump, water_logging, streetlight, school_infrastructure, "
            "healthcare_facility, unsafe_area, other."
        )
        contents: list[Any] = [prompt]
        contents.append(self._photo_part(photo_url))
        response = self._client.models.generate_content(
            model=self._model,
            contents=contents,
            config=self._types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        data = parse_json_object(response.text)
        return PhotoAnalysis(
            tags=[str(tag) for tag in data.get("tags", [])],
            description=data.get("description"),
            confidence=_float_or_none(data.get("confidence")),
            provider_metadata={"photo_url": photo_url},
        )

    def _photo_part(self, photo_url: str) -> Any:
        mime_type = mimetypes.guess_type(photo_url)[0] or "image/jpeg"
        if photo_url.startswith("gs://") or photo_url.startswith("https://"):
            return self._types.Part.from_uri(file_uri=photo_url, mime_type=mime_type)

        path = Path(photo_url)
        data = path.read_bytes()
        return self._types.Part.from_bytes(data=data, mime_type=mime_type)


class SpeechToTextV2Provider:
    name = "cloud_speech_v2"

    def __init__(self, settings: Settings):
        if not settings.google_cloud_project:
            raise RuntimeError("GOOGLE_CLOUD_PROJECT is required for INGESTION_PROVIDER=google")

        try:
            from google.cloud.speech_v2 import SpeechClient
            from google.cloud.speech_v2.types import cloud_speech
        except ImportError as exc:
            raise RuntimeError("google-cloud-speech is required for INGESTION_PROVIDER=google") from exc

        self._cloud_speech = cloud_speech
        self._client = SpeechClient()
        self._recognizer = (
            f"projects/{settings.google_cloud_project}/locations/"
            f"{settings.google_cloud_location}/recognizers/{settings.speech_recognizer}"
        )
        self._language_codes = settings.speech_language_codes or DEFAULT_LANGUAGE_CODES

    def transcribe(self, audio_url: str, language_hint: str | None = None) -> TranscriptResult:
        language_codes = [language_hint] if language_hint and language_hint != "auto" else list(self._language_codes)
        config = self._cloud_speech.RecognitionConfig(
            auto_decoding_config=self._cloud_speech.AutoDetectDecodingConfig(),
            language_codes=language_codes,
            model="latest_long",
            features=self._cloud_speech.RecognitionFeatures(enable_automatic_punctuation=True),
        )
        request_kwargs: dict[str, Any] = {
            "recognizer": self._recognizer,
            "config": config,
        }
        if audio_url.startswith("gs://"):
            request_kwargs["uri"] = audio_url
        else:
            request_kwargs["content"] = Path(audio_url).read_bytes()

        request = self._cloud_speech.RecognizeRequest(**request_kwargs)
        response = self._client.recognize(request=request)
        parts = []
        confidences: list[float] = []
        detected_language = None
        for result in response.results:
            if not result.alternatives:
                continue
            alternative = result.alternatives[0]
            parts.append(alternative.transcript)
            if alternative.confidence:
                confidences.append(float(alternative.confidence))
            if getattr(result, "language_code", None):
                detected_language = result.language_code

        confidence = sum(confidences) / len(confidences) if confidences else None
        return TranscriptResult(
            text=" ".join(part.strip() for part in parts if part.strip()),
            detected_language=detected_language,
            confidence=confidence,
            provider_metadata={"recognizer": self._recognizer},
        )


def parse_json_object(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?", "", stripped).strip()
        stripped = re.sub(r"```$", "", stripped).strip()
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"provider returned non-JSON response: {text[:200]}") from exc
    if not isinstance(data, dict):
        raise RuntimeError("provider returned JSON, but not an object")
    return data


def _float_or_none(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
