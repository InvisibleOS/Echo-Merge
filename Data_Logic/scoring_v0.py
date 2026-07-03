import json
from collections import defaultdict

def run_scoring_v0(input_json_path):
    print(f"📊 Loading Day 1 submissions from {input_json_path}...")
    with open(input_json_path, 'r', encoding='utf-8') as f:
        submissions = json.load(f)
        
    # Step 1: Mock Clustering
    # Grouping by Location + Category to simulate tomorrow's vector clustering
    clusters = defaultdict(list)
    for sub in submissions:
        cluster_key = f"{sub['canonical_location']} | {sub['category']}"
        clusters[cluster_key].append(sub)
        
    print(f"🧩 Grouped {len(submissions)} raw submissions into {len(clusters)} unique clusters.")
    
    # Step 2: Calculate Demand Score (v0 Logic)
    ranked_priorities = []
    cluster_counter = 1
    
    for cluster_title, subs in clusters.items():
        # Deduping: Count UNIQUE citizen IDs so one person spamming doesn't skew the score
        unique_citizens = set(sub['citizen_id_hash'] for sub in subs)
        demand_count = len(unique_citizens)
        
        # v0 Math: A very basic multiplier just to get a number on the board.
        # We will replace this with logarithmic scaling and equity weighting later.
        demand_score = demand_count * 15.0 
        
        priority_item = {
            "work_id": f"CLUSTER-V0-{cluster_counter}",
            "title": f"Address {cluster_title.split('|')[1].strip()} issue at {cluster_title.split('|')[0].strip()}",
            "category": subs[0]['category'],
            "demand_count": demand_count,
            "demand_score": min(demand_score, 100.0), # Cap at 100
            "supporting_evidence_count": len(subs),
            "explanation": f"Ranked purely on demand volume: {demand_count} unique citizens reported this."
        }
        ranked_priorities.append(priority_item)
        cluster_counter += 1
        
    # Step 3: Rank the list from highest score to lowest
    ranked_priorities.sort(key=lambda x: x['demand_score'], reverse=True)
    
    # Inject the final rank number
    for rank_index, item in enumerate(ranked_priorities, 1):
        item['rank'] = rank_index
        
    print("\n🏆 Top 3 Priority Items (v0):")
    for item in ranked_priorities[:3]:
        print(f"Rank {item['rank']}: {item['title']} (Score: {item['demand_score']}, Citizens: {item['demand_count']})")
        
    return ranked_priorities

if __name__ == "__main__":
    # Run the function on the JSON file you generated earlier
    run_scoring_v0("day1_enriched_submissions.json")