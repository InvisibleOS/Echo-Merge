import sys
import os
import json

# Add parent directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db_client import DBClient
from embed_pipeline import EmbeddingPipeline
from scoring_v2 import ScoringPipelineV2
from solution_planner import SolutionPlanner
from notification_service import NotificationService

def process_submission(payload_json: str):
    print("🚀 Starting background submission processing...", flush=True)
    try:
        submission = json.loads(payload_json)
    except json.JSONDecodeError:
        print("❌ Invalid JSON payload.")
        sys.exit(1)
        
    db = DBClient()
    
    # NLP enrichment is now handled upstream by the Ingestion Service
    # We expect `submission` to already contain `normalized_text_en`, `category`, etc.
    
    if "id" not in submission:
        print("❌ Submission missing ID.")
        sys.exit(1)
        
    # Attempt to derive constituency from ward if not provided
    constituency = submission.get("constituency")
    ward = submission.get("geo", {}).get("ward") if submission.get("geo") else None
    
    if not constituency and ward:
        # Search demographics for a matching ward
        for (c_name, w_name) in db.demographics.keys():
            if w_name == ward:
                constituency = c_name
                submission["constituency"] = constituency
                break
                
    if not constituency:
        # Default fallback for demo purposes
        print("⚠️ No constituency provided or found. Defaulting to 'Bengaluru South' for Demo.")
        constituency = "Bengaluru South"
        submission["constituency"] = constituency
        
    # 2. Embedding & Saving Raw Submission
    print("🧬 Generating Embeddings...", flush=True)
    pipeline = EmbeddingPipeline(db)
    pipeline.process_and_store_submission(submission)
    
    # 3. Generate Filtered priorities for the constituency
    print(f"⚡ Processing Priority Scores for Constituency: {constituency}...", flush=True)
    scoring = ScoringPipelineV2(db)
    priorities = scoring.run_priority_generation_v2(constituency=constituency)
    
    # 4. Solution Planning for top priorities
    print(f"🧠 Generating Solution Plans for prioritized items...", flush=True)
    planner = SolutionPlanner()
    for item in priorities:
        category = item["category"]
        need_type = item["title"]
        item_ward = item["hotspot_geo"].get("ward", ward) if item.get("hotspot_geo") else ward
        
        demo = db.get_demographics(constituency, item_ward) or {}
        
        # safely extract strings from supporting evidence
        summary_texts = []
        for e in item.get("supporting_evidence", []):
            if isinstance(e, dict):
                if "text" in e:
                    summary_texts.append(e["text"])
                elif "normalized_text_en" in e:
                    summary_texts.append(e["normalized_text_en"])
            elif isinstance(e, str):
                summary_texts.append(e)
                
        summary = " | ".join(summary_texts)
        
        plan = planner.generate_solution_plan(category, need_type, item_ward, demo, summary)
        item["solution_plan"] = plan
        
        # Save updated priority item
        db.insert_priority_item(item)
        
    # 5. Send MP Digest
    print("📤 Compiling and Sending MP Digest...", flush=True)
    notifier = NotificationService(db)
    notifier.compile_and_send_mp_digest(constituency, priorities)
    
    print("✅ Background processing completed successfully.", flush=True)

if __name__ == "__main__":
    # Read payload from stdin
    input_data = sys.stdin.read()
    process_submission(input_data)
