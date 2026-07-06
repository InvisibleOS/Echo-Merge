import json
import os
import requests

URL = os.popen("grep 'SUPABASE_URL' .env.local | head -1 | cut -d '=' -f2").read().strip()
KEY = os.popen("grep 'SUPABASE_SERVICE_ROLE_KEY' .env.local | head -1 | cut -d '=' -f2").read().strip()

from Data_Logic.db_client import DBClient
from Data_Logic.scoring_v2 import ScoringPipelineV2

db = DBClient()
pipeline = ScoringPipelineV2(db)
priorities = pipeline.run_priority_generation_v2()

headers = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

for idx, p in enumerate(priorities):
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
        print(f"Successfully uploaded {idx+1}/{len(priorities)}")
        
print("Done!")
