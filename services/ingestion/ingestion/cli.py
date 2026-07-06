from __future__ import annotations

import argparse
import json
from typing import Any

from ingestion.config import load_settings
from ingestion.demo_cases import DEMO_SUBMISSIONS
from ingestion.models import RawSubmission
from ingestion.service import build_service


def main() -> None:
    parser = argparse.ArgumentParser(description="Person 3 multilingual ingestion CLI")
    parser.add_argument("--demo", action="store_true", help="Run built-in multilingual demo cases")
    parser.add_argument("--text", help="Raw citizen text")
    parser.add_argument("--audio-url", help="Audio URI or local file path")
    parser.add_argument("--photo-url", help="Photo URI or local file path")
    parser.add_argument("--language", help="BCP-47 language hint, such as hi-IN or te-IN")
    parser.add_argument("--id", default="cli-submission", help="Submission id")
    parser.add_argument("--ward", help="Ward label")
    args = parser.parse_args()

    service = build_service(load_settings())

    if args.demo:
        for submission in DEMO_SUBMISSIONS:
            print_json(service.enrich(submission).to_dict())
        return

    if not any([args.text, args.audio_url, args.photo_url]):
        parser.error("provide --demo or at least one of --text, --audio-url, --photo-url")

    payload: dict[str, Any] = {
        "id": args.id,
        "raw_text": args.text,
        "audio_url": args.audio_url,
        "photo_url": args.photo_url,
        "language": args.language,
    }
    if args.ward:
        payload["geo"] = {"ward": args.ward}

    submission = RawSubmission.from_mapping(payload)
    print_json(service.enrich(submission).to_dict())


def print_json(data: dict[str, Any]) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

