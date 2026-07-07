import os
import requests
from Data_Logic.db_client import DBClient
from Data_Logic.scoring_v2 import ScoringPipelineV2

URL = os.popen("grep 'SUPABASE_URL' .env.local | head -1 | cut -d '=' -f2").read().strip()
KEY = os.popen("grep 'SUPABASE_SERVICE_ROLE_KEY' .env.local | head -1 | cut -d '=' -f2").read().strip()

headers = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# 1. Wipe current priorities
print("Wiping Supabase priorities...")
requests.delete(f"{URL}/rest/v1/priorities?work_id=not.eq.dummy", headers=headers)

# 2. Generate new priorities using Engine v2
print("Generating new priorities...")
db = DBClient()
scoring = ScoringPipelineV2(db)

constituencies = ["Bengaluru South", "Lucknow", "Wayanad", "New Delhi", "Mumbai South"]
all_priorities = []

for c in constituencies:
    print(f"Clustering {c}...")
    priorities = scoring.run_priority_generation_v2(constituency=c)
    all_priorities.extend(priorities)

print(f"Generated {len(all_priorities)} priorities total.")

# 3. Upload them
for idx, p in enumerate(all_priorities):
    geo = p.get("hotspot_geo", {})
    geo["scoring_breakdown"] = p.get("scoring_breakdown")
    
    payload = {
        "work_id": p["work_id"],
        "title": p["title"],
        "category": p["category"],
        "demand_score": p["demand_score"],
        "demand_count": p["demand_count"],
        "hotspot_geo": geo,
        "supporting_evidence": p["supporting_evidence"],
        "rank": p["rank"],
        "explanation": p["explanation"]
    }
    
    res = requests.post(f"{URL}/rest/v1/priorities", headers=headers, json=payload)
    if res.status_code >= 400:
        print(f"Error uploading {p['work_id']}: {res.text}")
    else:
        pass
        
print("Successfully uploaded all priorities to Supabase!")
