from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ingestion.config import Settings
from ingestion.models import RawSubmission, ValidationError
from ingestion.service import build_service


class IngestionServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.service = build_service(Settings(provider="offline"))

    def test_hindi_road_text_enriches_to_required_shape(self) -> None:
        submission = RawSubmission.from_mapping(
            {
                "id": "s1",
                "raw_text": "हमारे वार्ड 12 में सड़क टूट गई है",
                "language": "hi-IN",
                "geo": {"ward": "Ward 12"},
            }
        )

        enriched = self.service.enrich(submission).to_dict()

        self.assertEqual(enriched["category"], "Mobility - Roads, Footpaths and Infrastructure")
        self.assertEqual(enriched["urgency"], "High")
        self.assertEqual(enriched["detected_language"], "hi-IN")
        self.assertIn("Road repair", enriched["normalized_text_en"])
        self.assertEqual(enriched["canonical_location"], "Ward 12")
        self.assertIn("text", enriched["source_modalities"])

    def test_telugu_water_text_classifies_as_water(self) -> None:
        submission = RawSubmission.from_mapping(
            {
                "id": "s2",
                "raw_text": "మా వీధిలో తాగునీరు మూడు రోజులుగా రావడం లేదు",
                "language": "te-IN",
            }
        )

        enriched = self.service.enrich(submission)

        self.assertEqual(enriched.category, "Water Supply and Services")
        self.assertEqual(enriched.need_type, "Service Delivery")
        self.assertTrue(enriched.normalized_text_en)

    def test_voice_note_is_transcribed_then_enriched(self) -> None:
        submission = RawSubmission.from_mapping(
            {
                "id": "s3",
                "audio_url": "demo://hindi-road",
                "language": "hi-IN",
            }
        )

        enriched = self.service.enrich(submission).to_dict()

        self.assertEqual(enriched["category"], "Mobility - Roads, Footpaths and Infrastructure")
        self.assertIn("audio", enriched["source_modalities"])
        self.assertIn("सड़क", enriched["transcript"])
        self.assertEqual(enriched["provider_metadata"]["speech_provider"], "offline_speech_demo")

    def test_photo_only_submission_gets_photo_tags(self) -> None:
        submission = RawSubmission.from_mapping(
            {
                "id": "s4",
                "photo_url": "demo://garbage-dump",
                "language": "en-IN",
            }
        )

        enriched = self.service.enrich(submission).to_dict()

        self.assertEqual(enriched["category"], "Garbage and Unsanitary Practices")
        self.assertIn("garbage_dump", enriched["extracted_entities"])
        self.assertIn("photo", enriched["source_modalities"])

    def test_hinglish_streetlight_is_electricity_not_roads(self) -> None:
        submission = RawSubmission.from_mapping(
            {
                "id": "s5",
                "raw_text": "School ke paas streetlight nahi jal rahi hai",
                "language": "hi-Latn",
                "geo": {"ward": "Ward 7"},
            }
        )

        enriched = self.service.enrich(submission).to_dict()

        self.assertEqual(enriched["category"], "Streetlights")
        self.assertIn("Ward 7", enriched["extracted_entities"])

    def test_marathi_clinic_need_classifies_as_healthcare(self) -> None:
        submission = RawSubmission.from_mapping(
            {
                "id": "s6",
                "raw_text": "आमच्या भागात जवळपास दवाखाना नाही, वृद्धांना खूप त्रास होतो",
                "language": "mr-IN",
            }
        )

        enriched = self.service.enrich(submission).to_dict()

        self.assertEqual(enriched["category"], "PWD")
        self.assertIn("elderly", enriched["extracted_entities"])

    def test_rejects_empty_submission(self) -> None:
        with self.assertRaises(ValidationError):
            RawSubmission.from_mapping({"id": "empty"})


if __name__ == "__main__":
    unittest.main()
