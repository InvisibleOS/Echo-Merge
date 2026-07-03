import sys
import os
import json

# Add parent directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db_client import DBClient
from mock_public_data import generate_mock_public_data
from embed_pipeline import EmbeddingPipeline
from scoring_v2 import ScoringPipelineV2

def run_integration_pipeline_v2():
    print("🚀 Starting Echo-Merge Data/Logic Integration Pipeline v2...")
    
    # 1. Initialize DB Client
    db = DBClient()
    
    # 2. Seed Public Demographics and Facilities
    generate_mock_public_data(db)
    
    # 3. Load Day 1 Enriched Submissions JSON
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    submissions_path = os.path.join(project_root, "day1_enriched_submissions.json")
    
    if not os.path.exists(submissions_path):
        print(f"❌ Error: {submissions_path} not found. Please generate the file first.")
        return
        
    with open(submissions_path, 'r', encoding='utf-8') as f:
        submissions = json.load(f)
        
    print(f"📦 Loaded {len(submissions)} enriched submissions.")
    
    # 4. Generate Embeddings and Save Submissions to DB
    pipeline = EmbeddingPipeline(db)
    print("🧠 Processing embeddings and saving to database...")
    for idx, sub in enumerate(submissions):
        pipeline.process_and_store_submission(sub)
        if (idx + 1) % 10 == 0:
            print(f"   - Processed {idx + 1}/{len(submissions)} submissions...")
            
    print("✅ Submissions and embeddings saved to database.")
    
    # 5. Run Clustering and Priority Scoring v2
    scoring = ScoringPipelineV2(db)
    priorities = scoring.run_priority_generation_v2()
    
    # 6. Export Ranked priorities to JSON (dashboard data contract)
    output_path = os.path.join(project_root, "day1_priorities_v2.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(priorities, f, indent=2, ensure_ascii=False)
        
    print(f"\n💾 Ranked priorities exported successfully to: {output_path}")
    
    # Push to DB (for Supabase / Next.js integration)
    print("⚡ Uploading priorities to database...")
    db.clear_priorities()
    for item in priorities:
        db.insert_priority_item(item)
    print("✅ Uploaded priorities to database.")
    
    # 7. Print Ranked Results Summary
    print("\n🏆 Top 5 Priority Items (v2):")
    for item in priorities[:5]:
        print(f"Rank {item['rank']}: {item['title']}")
        print(f"  Category: {item['category']}")
        print(f"  Score: {item['demand_score']} | Reports: {item['supporting_evidence_count']} | Ward: {item['hotspot_geo']['ward']}")
        print(f"  Explanation: {item['explanation']}")
        print("-" * 60)

if __name__ == "__main__":
    run_integration_pipeline_v2()
