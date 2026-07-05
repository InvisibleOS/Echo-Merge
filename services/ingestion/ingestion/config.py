from __future__ import annotations

import os
from dataclasses import dataclass, field


DEFAULT_LANGUAGE_CODES = (
    "hi-IN",
    "te-IN",
    "ta-IN",
    "bn-IN",
    "mr-IN",
    "en-IN",
)


@dataclass(frozen=True)
class Settings:
    provider: str = "offline"
    google_cloud_project: str | None = None
    google_cloud_location: str = "us-central1"
    gemini_model: str = "gemini-1.5-flash"
    speech_recognizer: str = "_"
    speech_language_codes: tuple[str, ...] = field(default_factory=lambda: DEFAULT_LANGUAGE_CODES)


def load_settings() -> Settings:
    provider = os.getenv("INGESTION_PROVIDER", "offline").strip().lower() or "offline"
    language_codes = tuple(
        code.strip()
        for code in os.getenv("SPEECH_LANGUAGE_CODES", ",".join(DEFAULT_LANGUAGE_CODES)).split(",")
        if code.strip()
    )

    return Settings(
        provider=provider,
        google_cloud_project=os.getenv("GOOGLE_CLOUD_PROJECT") or None,
        google_cloud_location=os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1"),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
        speech_recognizer=os.getenv("SPEECH_RECOGNIZER", "_"),
        speech_language_codes=language_codes or DEFAULT_LANGUAGE_CODES,
    )

