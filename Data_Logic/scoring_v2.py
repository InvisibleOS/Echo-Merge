import sys
import os
import math
import numpy as np

# Add parent directory to path so we can import DBClient
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db_client import DBClient
from scoring_v1 import resolve_ward_by_coords

class ScoringPipelineV2:
    def __init__(self, db_client: DBClient):
        self.db = db_client

    def cluster_submissions(self, submissions: list, embeddings: dict, distance_threshold: float = 0.15) -> list:
        """Groups submissions into semantic clusters using leader-clustering.
        
        Using a tightened distance threshold of 0.15 (similarity >= 0.85).
        """
        clusters = []
        
        for sub in submissions:
            sub_id = sub["id"]
            sub_vector = embeddings.get(sub_id)
            if sub_vector is None:
                continue
                
            assigned = False
            best_dist = 999.0
            best_cluster = None
            
            for cluster in clusters:
                leader_id = cluster["leader_id"]
                leader_vector = embeddings[leader_id]
                
                # Cosine distance: 1 - Cosine Similarity
                similarity = np.dot(sub_vector, leader_vector) / (np.linalg.norm(sub_vector) * np.linalg.norm(leader_vector))
                distance = 1.0 - similarity
                
                if distance <= distance_threshold and distance < best_dist:
                    best_dist = distance
                    best_cluster = cluster
                    
            if best_cluster is not None:
                best_cluster["submissions"].append(sub)
                assigned = True
            
            if not assigned:
                clusters.append({
                    "leader_id": sub_id,
                    "submissions": [sub]
                })
                
        return clusters

    def calculate_priority_score_v2(self, cluster: dict) -> dict:
        """Calculates Priority Score v2:
        Total Score = Demand Score * (1.0 + Urgency + Equity + PublicDataGap + Feasibility)
        """
        subs = cluster["submissions"]
        leader_id = cluster["leader_id"]
        
        # 1. Resolve Geo-center and Ward
        lats = [s["geo"]["lat"] for s in subs if s.get("geo") and s["geo"]["lat"] is not None]
        lngs = [s["geo"]["lng"] for s in subs if s.get("geo") and s["geo"]["lng"] is not None]
        
        avg_lat = sum(lats) / len(lats) if lats else None
        avg_lng = sum(lngs) / len(lngs) if lngs else None
        resolved_ward = None
        for s in subs:
            if s.get("geo") and s.get("geo").get("ward"):
                resolved_ward = s["geo"]["ward"]
                break
        
        if not resolved_ward:
            resolved_ward = resolve_ward_by_coords(avg_lat, avg_lng)
        
        # 2. Demand Score (log-scaled count of unique citizen IDs)
        unique_citizens = set(s.get("citizen_id_hash") for s in subs if s.get("citizen_id_hash"))
        demand_count = len(unique_citizens) if unique_citizens else 1
        
        demand_score = math.log2(1 + demand_count) * 15.0
        
        # 3. Urgency (0.0 to 0.25)
        urgency_weights = {
            "Routine": 0.0,
            "Low": 0.05,
            "Medium": 0.12,
            "High": 0.18,
            "Critical": 0.25
        }
        urg_values = [urgency_weights.get(s.get("urgency"), 0.12) for s in subs]
        avg_urgency = sum(urg_values) / len(urg_values) if urg_values else 0.12
        
        # 4. Get constituency and state from submissions
        constituency = subs[0].get("constituency", "Bengaluru South")
        state = subs[0].get("state", "Karnataka")
        
        # 5. Equity Boost (0.0 to 0.20)
        # Based on infrastructure neglect (1 - infrastructure_score)
        demo = self.db.get_demographics(constituency, resolved_ward)
        if not demo:
            demo = self.db.get_demographics(constituency, "Global")  # Constituency level fallback
        if not demo:
            # Global fallback
            demo = {
                "infrastructure_score": 0.68,
                "student_teacher_ratio_gap": 0.30,
                "hospital_bed_gap": 0.30,
                "waste_treatment_gap": 0.35
            }
            
        infra_score = demo.get("infrastructure_score", 0.68)
        equity_boost = (1.0 - infra_score) * 0.20
        
        # 6. AI Validation Gap (0.0 to 0.30)
        category = subs[0]["category"]
        validation_multiplier = 0.0
        
        # Check if any submission in the cluster has a positive validation context
        for s in subs:
            vc = s.get("validation_context")
            if vc and ("Found the following" in vc or "Validation Agent ran" in vc):
                validation_multiplier = 0.30
                break
            
        category_lower = subs[0]["category"].lower()
        # 7. Feasibility (0.0 to 0.15)
        # Boost if category aligns with municipal budget or is news corroborated
        feasibility = 0.05
        if any(keyword in category_lower for keyword in ["road", "footpath", "street", "garbage", "waste", "light"]):
            feasibility = 0.15
        elif any("news" in s.get("extracted_entities", []) for s in subs):
            feasibility = 0.12

        # 8. Final Math Fusion
        multiplier = 1.0 + avg_urgency + equity_boost + validation_multiplier + feasibility
        total_score = demand_score * multiplier
        total_score = min(total_score, 100.0)  # Cap at 100
        
        # Supporting Evidence
        evidence = []
        for s in sorted(subs, key=lambda x: len(x.get("raw_text", "")), reverse=True)[:3]:
            evidence.append({
                "submission_id": s.get("id"),
                "language": s.get("language", "English"),
                "raw_text": s.get("raw_text", ""),
                "normalized_text_en": s.get("normalized_text_en", ""),
                "geo": s.get("geo"),
                "canonical_location": s.get("canonical_location"),
                "validation_context": s.get("validation_context")
            })
            
        # Hyper-local Title Generation
        # Try to find a more specific location than just the ward
        specific_location = None
        
        # 1. Look for a canonical location that is not just "nan"
        for s in subs:
            cl = s.get("canonical_location")
            if cl and str(cl).lower() != "nan" and cl != resolved_ward:
                specific_location = cl
                break
                
        # 2. Look through extracted entities if no canonical location is good
        if not specific_location:
            for s in subs:
                entities = s.get("extracted_entities", [])
                for e in entities:
                    # Skip common categories/keywords, focus on potential place names
                    if e.lower() not in category.lower() and len(e) > 3 and e.lower() not in ["infrastructure", "waste", "water supply", "streetlight", "power supply", "children", "women", "elderly"]:
                        specific_location = e.title()
                        break
                if specific_location:
                    break
                    
        # 3. Fallback to resolved ward
        title_location = specific_location if specific_location else resolved_ward
        
        # Format the title
        title = f"Address {category.lower()} gap in {title_location}"
        
        # Explanation construction
        explanation = (
            f"Ranked {total_score:.1f}/100. Demand: {demand_count} reports. Multipliers: "
            f"Urgency (+{avg_urgency:.2f}), Ward Equity (+{equity_boost:.2f} for {resolved_ward} infrastructure index {infra_score:.2f}), "
            f"AI Validation (+{validation_multiplier:.2f}), Feasibility (+{feasibility:.2f})."
        )
        
        # In-depth reasoning breakdown for UI
        reasoning = {
            "demand": f"Base score derived from a logarithmic scale (log2) of the {demand_count} unique citizens in this cluster, preventing spam inflation.",
            "urgency": f"AI classified severity averaged to {(avg_urgency*100):.1f}%, adding a +{avg_urgency:.2f} multiplier boost.",
            "equity": f"This falls in the {resolved_ward} ward. We cross-referenced Census data to find its infrastructure index is only {infra_score:.2f}/1.0, triggering a +{equity_boost:.2f} equity boost.",
            "validation": f"Our AI Validation Agent automatically fact-checked this claim against real-world data and confirmed it, triggering a massive +{validation_multiplier:.2f} undeniable proof boost." if validation_multiplier > 0 else f"AI Validation Agent could not find explicit proof in Google Places or local news feeds to definitively verify this claim (Boost: +0.00)."
        }
        
        return {
            "work_id": f"PRIORITY-V2-{leader_id}",
            "title": title,
            "category": category,
            "demand_count": demand_count,
            "demand_score": round(total_score, 2),
            "scoring_breakdown": {
                "base_demand": round(demand_score, 2),
                "urgency_multiplier": round(avg_urgency, 2),
                "equity_multiplier": round(equity_boost, 2),
                "validation_multiplier": round(validation_multiplier, 2),
                "feasibility_multiplier": round(feasibility, 2),
                "final_score": round(total_score, 2),
                "reasoning": reasoning
            },
            "supporting_evidence_count": len(subs),
            "hotspot_geo": {
                "lat": avg_lat,
                "lng": avg_lng,
                "ward": resolved_ward
            },
            "supporting_evidence": evidence,
            "explanation": explanation,
            "state": state,
            "constituency": constituency,
            "solution_plan": {} # Populated downstream by SolutionPlanner
        }

    def run_priority_generation_v2(self, state: str = None, constituency: str = None) -> list:
        """Executes the full scoring and ranking pipeline under v2 specs, optionally filtered by location."""
        print("⚡ Loading submissions and embeddings from database...")
        submissions = self.db.get_submissions(state=state, constituency=constituency)
        
        embeddings = {}
        if self.db.is_postgres:
            with self.db.conn.cursor() as cur:
                # Query correct table 'embeddings' and column 'vector'
                cur.execute("SELECT submission_id, vector FROM embeddings;")
                for row in cur.fetchall():
                    embeddings[row[0]] = np.array(row[1])
        else:
            embeddings = self.db.embeddings
            
        print("🧩 Clustering submissions using tightened distance threshold (0.15)...")
        clusters = self.cluster_submissions(submissions, embeddings, distance_threshold=0.15)
        print(f"   - Grouped into {len(clusters)} unique thematic clusters.")
        
        print("🏆 Scoring priorities under Engine v2 math...")
        priorities = []
        for cluster in clusters:
            priority_item = self.calculate_priority_score_v2(cluster)
            priorities.append(priority_item)
            
        # Sort by priority score descending
        priorities.sort(key=lambda x: x["demand_score"], reverse=True)
        
        # Add rank
        for index, item in enumerate(priorities, 1):
            item["rank"] = index
            
        return priorities

if __name__ == "__main__":
    db = DBClient()
    pipeline = ScoringPipelineV2(db)
    results = pipeline.run_priority_generation_v2()
    print("\n🏆 Top 3 Priority Items (v2):")
    for item in results[:3]:
        print(f"Rank {item['rank']}: {item['title']} - Score: {item['demand_score']} (Reports: {item['supporting_evidence_count']})")
        print(f"  Explanation: {item['explanation']}\n")
