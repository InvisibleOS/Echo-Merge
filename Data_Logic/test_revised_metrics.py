import sys
import os
import json
import uuid

# Add parent directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db_client import DBClient
from mock_public_data import generate_mock_public_data
from embed_pipeline import EmbeddingPipeline
from scoring_v2 import ScoringPipelineV2
from solution_planner import SolutionPlanner
from notification_service import NotificationService

def generate_multi_constituency_submissions():
    """Generates a list of mock citizen submissions across multiple constituencies."""
    submissions = [
        # Bengaluru South - Garbage issues in BTM Layout
        {
            "id": str(uuid.uuid4()),
            "timestamp": "2026-07-05T09:00:00Z",
            "channel": "whatsapp",
            "raw_text": "Huge garbage accumulation near the BTM Layout main market. The smell is unbearable and dogs are tearing up plastic waste.",
            "normalized_text_en": "Huge garbage accumulation near the BTM Layout main market. The smell is unbearable and dogs are tearing up plastic waste.",
            "language": "English",
            "geo": {"lat": 12.9160, "lng": 77.6105, "ward": "BTM Layout"},
            "citizen_id_hash": "cit-bs-01",
            "state": "Karnataka",
            "constituency": "Bengaluru South",
            "category": "Garbage and Unsanitary Practices",
            "need_type": "Garbage Clearance",
            "urgency": "High",
            "sentiment": "angry",
            "canonical_location": "BTM Layout Market",
            "extracted_entities": ["garbage", "dogs"]
        },
        {
            "id": str(uuid.uuid4()),
            "timestamp": "2026-07-05T09:05:00Z",
            "channel": "web",
            "raw_text": "BTM Layout market square is filled with waste heap. Municipal cleaners are not clearing it regularly.",
            "normalized_text_en": "BTM Layout market square is filled with waste heap. Municipal cleaners are not clearing it regularly.",
            "language": "English",
            "geo": {"lat": 12.9168, "lng": 77.6100, "ward": "BTM Layout"},
            "citizen_id_hash": "cit-bs-02",
            "state": "Karnataka",
            "constituency": "Bengaluru South",
            "category": "Garbage and Unsanitary Practices",
            "need_type": "Garbage Clearance",
            "urgency": "Medium",
            "sentiment": "frustrated",
            "canonical_location": "BTM Layout Market",
            "extracted_entities": ["waste", "cleaners"]
        },
        # Bengaluru South - Water issues in Bellandur
        {
            "id": str(uuid.uuid4()),
            "timestamp": "2026-07-05T09:10:00Z",
            "channel": "web",
            "raw_text": "Drinking water supply is muddy and smells like sewage in Bellandur ward near the tech park.",
            "normalized_text_en": "Drinking water supply is muddy and smells like sewage in Bellandur ward near the tech park.",
            "language": "English",
            "geo": {"lat": 12.9310, "lng": 77.6780, "ward": "Bellandur"},
            "citizen_id_hash": "cit-bs-03",
            "state": "Karnataka",
            "constituency": "Bengaluru South",
            "category": "Water Supply and Services",
            "need_type": "Water Quality",
            "urgency": "Critical",
            "sentiment": "fearful",
            "canonical_location": "Bellandur Tech Park Road",
            "extracted_entities": ["water", "sewage"]
        },
        # Lucknow - Roads issues in Chowk
        {
            "id": str(uuid.uuid4()),
            "timestamp": "2026-07-05T09:20:00Z",
            "channel": "web",
            "raw_text": "Chowk market area roads are completely broken with deep potholes. Driving a two-wheeler is highly dangerous.",
            "normalized_text_en": "Chowk market area roads are completely broken with deep potholes. Driving a two-wheeler is highly dangerous.",
            "language": "English",
            "geo": {"lat": 26.8660, "lng": 80.9100, "ward": "Chowk"},
            "citizen_id_hash": "cit-lk-01",
            "state": "Uttar Pradesh",
            "constituency": "Lucknow",
            "category": "Mobility - Roads, Footpaths and Infrastructure",
            "need_type": "Pothole Repair",
            "urgency": "High",
            "sentiment": "frustrated",
            "canonical_location": "Chowk Bazaar",
            "extracted_entities": ["roads", "potholes", "two-wheeler"]
        },
        {
            "id": str(uuid.uuid4()),
            "timestamp": "2026-07-05T09:25:00Z",
            "channel": "whatsapp",
            "raw_text": "Accident happened on Chowk main road today due to a massive pothole. PWD must fix this immediately.",
            "normalized_text_en": "Accident happened on Chowk main road today due to a massive pothole. PWD must fix this immediately.",
            "language": "English",
            "geo": {"lat": 26.8665, "lng": 80.9105, "ward": "Chowk"},
            "citizen_id_hash": "cit-lk-02",
            "state": "Uttar Pradesh",
            "constituency": "Lucknow",
            "category": "Mobility - Roads, Footpaths and Infrastructure",
            "need_type": "Pothole Repair",
            "urgency": "Critical",
            "sentiment": "angry",
            "canonical_location": "Chowk Bazaar",
            "extracted_entities": ["accident", "pothole", "PWD"]
        },
        # Wayanad - School gaps in Kalpetta
        {
            "id": str(uuid.uuid4()),
            "timestamp": "2026-07-05T09:30:00Z",
            "channel": "web",
            "raw_text": "The government primary school in Kalpetta lacks proper desks and there are not enough teachers for 50 students.",
            "normalized_text_en": "The government primary school in Kalpetta lacks proper desks and there are not enough teachers for 50 students.",
            "language": "English",
            "geo": {"lat": 11.6100, "lng": 76.0830, "ward": "Kalpetta"},
            "citizen_id_hash": "cit-wy-01",
            "state": "Kerala",
            "constituency": "Wayanad",
            "category": "School Infrastructure and Quality",
            "need_type": "Teacher Shortage",
            "urgency": "High",
            "sentiment": "sad",
            "canonical_location": "Kalpetta Government School",
            "extracted_entities": ["school", "desks", "teachers"]
        }
    ]
    return submissions

def run_revised_optimization_pipeline():
    print("🚀 Starting Echo-Merge Nationwide Optimization Pipeline...")
    
    # 1. Initialize DB Client
    db = DBClient()
    
    # 2. Seed Directory & Public datasets
    generate_mock_public_data(db)
    
    # 3. Load & Process Submissions
    submissions = generate_multi_constituency_submissions()
    print(f"📦 Generated {len(submissions)} multi-constituency citizen submissions.")
    
    pipeline = EmbeddingPipeline(db)
    for sub in submissions:
        # Generate embedding and save raw + enrichment to database
        pipeline.process_and_store_submission(sub)
        
    print("✅ Submissions and embeddings saved to database.")

    # 4. Generate Filtered priorities for Bengaluru South
    scoring = ScoringPipelineV2(db)
    planner = SolutionPlanner()
    notifier = NotificationService(db)
    
    constituencies_to_test = ["Bengaluru South", "Lucknow", "Wayanad"]
    
    for constituency in constituencies_to_test:
        print(f"\n⚡ Processing Priority Scores for Constituency: {constituency}...")
        
        # Generate ranked priorities filtered by constituency
        priorities = scoring.run_priority_generation_v2(constituency=constituency)
        
        # Attach AI Solution plans
        print(f"🧠 Generating Solution Plans for {len(priorities)} prioritized items...")
        for item in priorities:
            category = item["category"]
            need_type = item["title"]
            ward = item["hotspot_geo"]["ward"]
            
            # Retrieve demographics for data gap indicator context
            demo = db.get_demographics(constituency, ward) or {}
            
            # Summary of complaints text
            summary_texts = [e["normalized_text_en"] for e in item["supporting_evidence"]]
            summary = " | ".join(summary_texts)
            
            # Generate AI plan
            plan = planner.generate_solution_plan(category, need_type, ward, demo, summary)
            item["solution_plan"] = plan
            
            # Insert priority item into DB
            db.insert_priority_item(item)
            
        print(f"✅ Priorities with Solution Plans stored in database.")
        
        # 5. Compile and send MP notification
        notifier.compile_and_send_mp_digest(constituency, priorities)

    # 6. Verify printout of a compiled report
    print("\n🏆 Top Priority Solution Summary (Bengaluru South):")
    bs_priorities = [p for p in db.priorities if p.get("constituency") == "Bengaluru South"]
    if bs_priorities:
        top_item = bs_priorities[0]
        print(f"Rank {top_item.get('rank', 1)}: {top_item['title']} - Score: {top_item['demand_score']}")
        print(f"  Primary Agency: {top_item['solution_plan'].get('primary_department')}")
        print(f"  Budget Tier: {top_item['solution_plan'].get('estimated_budget_tier')}")
        print(f"  Timeline: {top_item['solution_plan'].get('remediation_timeline')}")
        print("  Action Steps:")
        for step in top_item['solution_plan'].get('action_steps', []):
            print(f"    - {step}")
            
    print("\n✅ Verification pipeline finished successfully.")

if __name__ == "__main__":
    run_revised_optimization_pipeline()
