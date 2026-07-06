from __future__ import annotations

from ingestion.models import RawSubmission


DEMO_SUBMISSIONS = [
    RawSubmission.from_mapping(
        {
            "id": "demo-hi-road",
            "raw_text": "हमारे वार्ड 12 में सड़क टूट गई है और बारिश में पानी भर जाता है",
            "language": "hi-IN",
            "geo": {"ward": "Ward 12"},
        }
    ),
    RawSubmission.from_mapping(
        {
            "id": "demo-te-water",
            "raw_text": "మా వీధిలో తాగునీరు మూడు రోజులుగా రావడం లేదు",
            "language": "te-IN",
            "geo": {"ward": "Ward 5"},
        }
    ),
    RawSubmission.from_mapping(
        {
            "id": "demo-ta-garbage",
            "raw_text": "எங்கள் பகுதியில் குப்பை எடுக்கவில்லை, துர்நாற்றம் வருகிறது",
            "language": "ta-IN",
            "geo": {"ward": "Ward 3"},
        }
    ),
    RawSubmission.from_mapping(
        {
            "id": "demo-bn-school",
            "raw_text": "স্কুলের কাছে রাস্তা খুব খারাপ, বাচ্চাদের যেতে সমস্যা হচ্ছে",
            "language": "bn-IN",
            "geo": {"ward": "Ward 9"},
        }
    ),
    RawSubmission.from_mapping(
        {
            "id": "demo-mr-health",
            "raw_text": "आमच्या भागात जवळपास दवाखाना नाही, वृद्धांना खूप त्रास होतो",
            "language": "mr-IN",
            "geo": {"ward": "Ward 2"},
        }
    ),
    RawSubmission.from_mapping(
        {
            "id": "demo-hinglish-light",
            "raw_text": "School ke paas streetlight nahi jal rahi hai, raat ko unsafe lagta hai",
            "language": "hi-Latn",
            "geo": {"ward": "Ward 7"},
        }
    ),
    RawSubmission.from_mapping(
        {
            "id": "demo-audio",
            "audio_url": "demo://hindi-road",
            "language": "hi-IN",
            "geo": {"ward": "Ward 12"},
        }
    ),
    RawSubmission.from_mapping(
        {
            "id": "demo-photo",
            "photo_url": "demo://garbage-dump",
            "language": "en-IN",
            "geo": {"ward": "Ward 4"},
        }
    ),
]

