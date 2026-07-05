import sys
import os
import json
import uuid

# Add parent directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db_client import DBClient
from embed_pipeline import EmbeddingPipeline
from scoring_v2 import ScoringPipelineV2
from solution_planner import SolutionPlanner
from notification_service import NotificationService

class NLPEnricher:
    def __init__(self):
        self.use_vertex = False
        self.project_id = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("ANTIGRAVITY_PROJECT_ID")
        
        if self.project_id and self.project_id != "outside-of-project":
            try:
                import vertexai
                from vertexai.generative_models import GenerativeModel
                vertexai.init(project=self.project_id, location="us-central1")
                self.model = GenerativeModel("gemini-1.5-flash")
                self.use_vertex = True
                print("🤖 Vertex AI Gemini 1.5 model initialized successfully for NLP Enricher.")
            except Exception as e:
                print(f"⚠️ Failed to initialize Vertex AI Gemini model ({e}). Using rule-based fallback NLP.")
        else:
            print("ℹ️ Google Cloud Project not configured. Using rule-based fallback NLP.")
            
    def enrich(self, raw_text: str, geo: dict) -> dict:
        if self.use_vertex:
            try:
                from vertexai.generative_models import GenerationConfig
                prompt = f"""
                You are an AI that classifies citizen complaints in India.
                Given the complaint text: "{raw_text}"
                
                Provide the following in JSON format WITHOUT markdown wrapping:
                - normalized_text_en (translate to English and normalize)
                - category (e.g. Mobility - Roads, Footpaths and Infrastructure, Garbage and Unsanitary Practices, Water Supply and Services)
                - need_type (e.g. Pothole Repair, Garbage Clearance, Drainage Repair)
                - urgency (Low, Medium, High, Critical)
                - sentiment (angry, frustrated, fearful, sad, neutral)
                - extracted_entities (a list of keywords)
                """
                response = self.model.generate_content(
                    prompt,
                    generation_config=GenerationConfig(
                        response_mime_type="application/json",
                        temperature=0.1
                    )
                )
                res = json.loads(response.text)
                res["canonical_location"] = f"{geo.get('ward', 'Unknown Ward')}"
                return res
            except Exception as e:
                print(f"⚠️ Gemini enrichment failed ({e}). Falling back to rule-based.")
                
        # Rule based fallback
        text = raw_text.lower()
        category = 'Public Infrastructure'
        need_type = 'General Maintenance'
        urgency = 'Medium'
        normalized_text_en = raw_text
        
        if any(w in text for w in ['road', 'pothole', 'सड़क', 'potholes', 'ರಸ್ತೆ']):
            category = 'Mobility - Roads, Footpaths and Infrastructure'
            need_type = 'Pothole Repair'
            urgency = 'High'
            normalized_text_en = 'The road has major potholes and is unsafe for traffic.'
        elif any(w in text for w in ['water', 'drain', 'leak', 'पानी', 'ನೀರು', 'drainage']):
            category = 'Water Supply and Services'
            need_type = 'Drainage Repair'
            urgency = 'High'
            normalized_text_en = 'Blocked drainage is causing water overflow and health issues.'
        elif any(w in text for w in ['light', 'street', 'dark', 'बिजली', 'ಕತ್ತಲು']):
            category = 'Streetlights'
            need_type = 'Streetlight Repair'
            urgency = 'Medium'
            normalized_text_en = 'Streetlights are broken, causing safety concerns at night.'
        elif any(w in text for w in ['waste', 'garbage', 'trash', 'कचरा', 'ಕಸ']):
            category = 'Garbage and Unsanitary Practices'
            need_type = 'Garbage Clearance'
            urgency = 'Medium'
            normalized_text_en = 'Garbage has accumulated at the corner and needs clearance.'

        return {
            "normalized_text_en": normalized_text_en,
            "category": category,
            "need_type": need_type,
            "urgency": urgency,
            "sentiment": "frustrated",
            "canonical_location": geo.get('ward', 'Unknown Ward'),
            "extracted_entities": [need_type.lower()]
        }

def process_submission(payload_json: str):
    print("🚀 Starting background submission processing...", flush=True)
    try:
        submission = json.loads(payload_json)
    except json.JSONDecodeError:
        print("❌ Invalid JSON payload.")
        sys.exit(1)
        
    db = DBClient()
    
    # 1. NLP Enrichment
    print("🧠 Running NLP Enrichment...", flush=True)
    enricher = NLPEnricher()
    enriched_data = enricher.enrich(submission.get("raw_text", ""), submission.get("geo", {}))
    
    # Merge enriched data into submission dict
    for k, v in enriched_data.items():
        submission[k] = v
        
    # Ensure ID exists
    if "id" not in submission:
        submission["id"] = str(uuid.uuid4())
        
    # 2. Embedding & Saving Raw Submission
    print("🧬 Generating Embeddings...", flush=True)
    pipeline = EmbeddingPipeline(db)
    pipeline.process_and_store_submission(submission)
    
    constituency = submission.get("constituency")
    ward = submission.get("geo", {}).get("ward")
    
    if not constituency:
        print("⚠️ No constituency provided. Skipping priority generation.")
        sys.exit(0)
        
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
        item_ward = item["hotspot_geo"].get("ward", ward)
        
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
