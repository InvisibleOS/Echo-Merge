import sys
import os
import math
import numpy as np

# Add parent directory to path so we can import DBClient
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db_client import DBClient
from embed_pipeline import EmbeddingPipeline

def resolve_ward_by_coords(lat, lng):
    """Resolves the Bengaluru South ward name using simple bounding boxes."""
    if lat is None or lng is None:
        return "Bengaluru South"
        
    # Bounding boxes
    if 12.920 <= lat <= 12.940 and 77.580 <= lng <= 77.600:
        return "Jayanagar"
    elif 12.905 <= lat <= 12.920 and 77.600 <= lng <= 77.620:
        return "BTM Layout"
    elif 12.925 <= lat <= 12.945 and 77.610 <= lng <= 77.635:
        return "Koramangala"
    elif 12.900 <= lat <= 12.925 and 77.630 <= lng <= 77.655:
        return "HSR Layout"
    elif 12.920 <= lat <= 12.945 and 77.655 <= lng <= 77.690:
        return "Bellandur"
    elif 12.870 <= lat <= 12.900 and 77.640 <= lng <= 77.670:
        return "Singasandra"
    elif 12.860 <= lat <= 12.890 and 77.610 <= lng <= 77.640:
        return "Begur"
    
    return "Bengaluru South"

class ScoringPipeline:
    def __init__(self, db_client: DBClient):
        self.db = db_client

    def cluster_submissions(self, submissions: list, embeddings: dict, distance_threshold: float = 0.3) -> list:
        """Groups submissions into clusters based on cosine distance of their vectors.
        
        Using leader-clustering algorithm.
        Returns a list of clusters, where each cluster is a dict:
        {
            "leader_id": str,
            "submissions": list of submissions (dicts)
        }
        """
        clusters = []
        
        for sub in submissions:
            sub_id = sub["id"]
            sub_vector = embeddings.get(sub_id)
            if sub_vector is None:
                continue
                
            # Find nearest cluster leader
            assigned = False
            best_dist = 999.0
            best_cluster = None
            
            for cluster in clusters:
                leader_id = cluster["leader_id"]
                leader_vector = embeddings[leader_id]
                
                # Calculate cosine distance: 1 - cosine_similarity
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

    def calculate_priority_score(self, cluster: dict) -> dict:
        """Computes priority score for a cluster based on:
        1. Demand Volume (log-scaled count of unique citizen IDs)
        2. Average Urgency (Critical=4.0, High=3.0, Medium=2.0, Low=1.0)
        3. Equity Multiplier (from public demographic data of the resolved ward)
        """
        subs = cluster["submissions"]
        leader_id = cluster["leader_id"]
        
        # 1. Resolve Geo-center and Ward
        lats = [s["geo"]["lat"] for s in subs if s.get("geo") and s["geo"]["lat"] is not None]
        lngs = [s["geo"]["lng"] for s in subs if s.get("geo") and s["geo"]["lng"] is not None]
        
        avg_lat = sum(lats) / len(lats) if lats else None
        avg_lng = sum(lngs) / len(lngs) if lngs else None
        resolved_ward = resolve_ward_by_coords(avg_lat, avg_lng)
        
        # 2. Demand Volume (Unique Citizens)
        unique_citizens = set(s.get("citizen_id_hash") for s in subs if s.get("citizen_id_hash"))
        demand_count = len(unique_citizens) if unique_citizens else 1
        
        # Log2 scaling to reduce noise from spamming, normalized
        demand_score = math.log2(1 + demand_count) * 15.0
        
        # 3. Urgency Scoring
        urgency_map = {"Critical": 4.0, "High": 3.0, "Medium": 2.0, "Low": 1.0}
        urgencies = [urgency_map.get(s.get("urgency"), 2.0) for s in subs]
        avg_urgency = sum(urgencies) / len(urgencies) if urgencies else 2.0
        
        # 4. Equity Scoring (Ward Demographics)
        demo = self.db.get_demographics(resolved_ward)
        if not demo:
            demo = self.db.get_demographics("Bengaluru South")  # Fallback
            
        infra_score = demo.get("infrastructure_score", 0.68)
        marginalized_ratio = demo.get("marginalized_ratio", 0.20)
        
        # Equity Weight formula: higher when infrastructure is poor and marginalized ratio is high
        equity_weight = (1.0 - infra_score) * 1.5 + marginalized_ratio * 1.2
        
        # 5. Final Score Fusion
        # Base Score is modified by Urgency and Equity
        total_score = demand_score * (1.0 + (0.15 * avg_urgency) + (0.20 * equity_weight))
        total_score = min(total_score, 100.0)  # Cap at 100
        
        # 6. Supporting Evidence (up to 3 submissions containing both original and translation)
        evidence = []
        for s in sorted(subs, key=lambda x: len(x.get("raw_text", "")), reverse=True)[:3]:
            evidence.append({
                "submission_id": s["id"],
                "language": s["language"],
                "raw_text": s["raw_text"],
                "normalized_text_en": s["normalized_text_en"]
            })
            
        category = subs[0]["category"]
        
        # Make explanation
        explanation = (
            f"Ranked {total_score:.1f}/100. Combines demand from {demand_count} citizens in the {resolved_ward} ward "
            f"(infrastructure index: {infra_score:.2f}). Citizen reports indicate an average urgency of {avg_urgency:.1f}/4.0."
        )
        
        return {
            "work_id": f"PRIORITY-{leader_id}",
            "title": f"Resolve {category.lower()} issues in {resolved_ward}",
            "category": category,
            "demand_count": demand_count,
            "demand_score": round(total_score, 2),
            "supporting_evidence_count": len(subs),
            "hotspot_geo": {
                "lat": avg_lat,
                "lng": avg_lng,
                "ward": resolved_ward
            },
            "supporting_evidence": evidence,
            "explanation": explanation
        }

    def run_priority_generation(self) -> list:
        """Executes the full scoring and ranking pipeline."""
        print("⚡ Loading submissions and embeddings from database...")
        submissions = self.db.get_submissions()
        
        # In Postgres mode or memory mode, fetch embeddings
        embeddings = {}
        if self.db.is_postgres:
            with self.db.conn.cursor() as cur:
                cur.execute("SELECT submission_id, embedding FROM submission_embeddings;")
                for row in cur.fetchall():
                    embeddings[row[0]] = np.array(row[1])
        else:
            embeddings = self.db.embeddings
            
        print(f"🧩 Clustering {len(submissions)} submissions using semantic similarity...")
        clusters = self.cluster_submissions(submissions, embeddings, distance_threshold=0.3)
        print(f"   - Grouped into {len(clusters)} unique thematic clusters.")
        
        print("🏆 Scoring and ranking priority items...")
        priorities = []
        for cluster in clusters:
            priority_item = self.calculate_priority_score(cluster)
            priorities.append(priority_item)
            
        # Sort by priority score descending
        priorities.sort(key=lambda x: x["demand_score"], reverse=True)
        
        # Add rank
        for index, item in enumerate(priorities, 1):
            item["rank"] = index
            
        return priorities

if __name__ == "__main__":
    db = DBClient()
    pipeline = ScoringPipeline(db)
    results = pipeline.run_priority_generation()
    print("\n🏆 Top 3 Priority Items (v1):")
    for item in results[:3]:
        print(f"Rank {item['rank']}: {item['title']} - Score: {item['demand_score']} (Reports: {item['supporting_evidence_count']})")
        print(f"  Explanation: {item['explanation']}\n")
