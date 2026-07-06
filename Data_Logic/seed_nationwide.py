import sys
import os
import json
import uuid
import random

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db_client import DBClient
from mock_public_data import generate_mock_public_data
from embed_pipeline import EmbeddingPipeline
from scoring_v2 import ScoringPipelineV2
from solution_planner import SolutionPlanner
from notification_service import NotificationService

def generate_multi_constituency_submissions():
    base_data = [
        # --- BENGALURU SOUTH (Karnataka) ---
        {"ward": "HSR Layout", "lat": 12.9121, "lng": 77.6446, "state": "Karnataka", "constituency": "Bengaluru South", "category": "Mobility - Roads, Footpaths and Infrastructure", "need_type": "Pothole Repair", "urgency": "Critical", "text": "The entire stretch of 27th Main HSR Layout is dotted with crater-sized potholes after the recent rains. Bikers are skidding daily. BBMP needs to act immediately.", "entities": ["27th Main", "HSR Layout", "BBMP", "potholes"]},
        {"ward": "HSR Layout", "lat": 12.9130, "lng": 77.6450, "state": "Karnataka", "constituency": "Bengaluru South", "category": "Mobility - Roads, Footpaths and Infrastructure", "need_type": "Pothole Repair", "urgency": "High", "text": "Near Agara Lake signal, the road is completely washed out. Traffic is crawling because everyone has to navigate the craters.", "entities": ["Agara Lake", "traffic", "craters"]},
        {"ward": "Bellandur", "lat": 12.9310, "lng": 77.6780, "state": "Karnataka", "constituency": "Bengaluru South", "category": "Pollution", "need_type": "Water Pollution", "urgency": "Critical", "text": "Bellandur Lake is frothing again. Toxic foam is flying onto the Outer Ring Road and causing severe irritation to commuters and nearby residents.", "entities": ["Bellandur Lake", "Outer Ring Road", "toxic foam"]},
        {"ward": "Bellandur", "lat": 12.9320, "lng": 77.6790, "state": "Karnataka", "constituency": "Bengaluru South", "category": "Pollution", "need_type": "Water Pollution", "urgency": "High", "text": "Unbearable stench from Bellandur lake today. It seems untreated industrial effluent is being dumped illegally at night.", "entities": ["Bellandur lake", "effluent", "stench"]},
        {"ward": "BTM Layout", "lat": 12.9160, "lng": 77.6105, "state": "Karnataka", "constituency": "Bengaluru South", "category": "Garbage and Unsanitary Practices", "need_type": "Waste Clearance", "urgency": "Medium", "text": "Pourakarmikas haven't collected wet waste for 4 days in BTM 2nd Stage. Bins are overflowing onto the footpath.", "entities": ["Pourakarmikas", "BTM 2nd Stage", "wet waste"]},
        {"ward": "BTM Layout", "lat": 12.9165, "lng": 77.6110, "state": "Karnataka", "constituency": "Bengaluru South", "category": "Garbage and Unsanitary Practices", "need_type": "Waste Clearance", "urgency": "High", "text": "Huge black spot developing near Udupi Garden signal. People are just throwing plastic covers full of garbage.", "entities": ["black spot", "Udupi Garden", "garbage"]},
        {"ward": "Jayanagar", "lat": 12.9298, "lng": 77.5824, "state": "Karnataka", "constituency": "Bengaluru South", "category": "Water Supply and Services", "need_type": "Borewell Drying", "urgency": "Critical", "text": "Cauvery water supply has completely stopped in Jayanagar 4th Block for a week. Our apartment's borewell has also dried up. We are surviving on expensive private tankers.", "entities": ["Cauvery water", "Jayanagar 4th Block", "borewell", "tankers"]},
        {"ward": "Koramangala", "lat": 12.9350, "lng": 77.6250, "state": "Karnataka", "constituency": "Bengaluru South", "category": "Traffic and Road Safety", "need_type": "Traffic Management", "urgency": "High", "text": "Absolute gridlock near Sony World Signal. The underpass construction has left zero space for pedestrians.", "entities": ["Sony World Signal", "gridlock", "underpass"]},
        {"ward": "Koramangala", "lat": 12.9360, "lng": 77.6260, "state": "Karnataka", "constituency": "Bengaluru South", "category": "Traffic and Road Safety", "need_type": "Illegal Parking", "urgency": "Medium", "text": "Cars parked on both sides of 80ft road near the restaurants block a whole lane. Traffic police isn't towing them.", "entities": ["80ft road", "parking", "traffic police"]},
        {"ward": "Basavanagudi", "lat": 12.9421, "lng": 77.5755, "state": "Karnataka", "constituency": "Bengaluru South", "category": "Electricity and Power Supply", "need_type": "Power Cuts", "urgency": "High", "text": "BESCOM is doing unscheduled power cuts of 3-4 hours every afternoon in Basavanagudi. Working from home is impossible.", "entities": ["BESCOM", "Basavanagudi", "power cuts"]},

        # --- LUCKNOW (Uttar Pradesh) ---
        {"ward": "Chowk", "lat": 26.8660, "lng": 80.9100, "state": "Uttar Pradesh", "constituency": "Lucknow", "category": "Sanitation", "need_type": "Drain Cleaning", "urgency": "Critical", "text": "The open nalas in Chowk market are choked with plastic. Sewage water is literally entering the shops after a small shower.", "entities": ["Chowk", "nalas", "sewage", "shops"]},
        {"ward": "Chowk", "lat": 26.8665, "lng": 80.9105, "state": "Uttar Pradesh", "constituency": "Lucknow", "category": "Sanitation", "need_type": "Drain Cleaning", "urgency": "High", "text": "Terrible mosquito breeding in the stagnant drain water near Akbari Gate. Dengue cases will spike if not cleaned.", "entities": ["Akbari Gate", "mosquito", "dengue"]},
        {"ward": "Gomti Nagar", "lat": 26.8500, "lng": 80.9900, "state": "Uttar Pradesh", "constituency": "Lucknow", "category": "Pollution", "need_type": "Water Pollution", "urgency": "Critical", "text": "The Gomti riverfront stretch smells awful today. You can see thick black sludge and dead fish floating near the barrage.", "entities": ["Gomti riverfront", "sludge", "dead fish"]},
        {"ward": "Gomti Nagar", "lat": 26.8510, "lng": 80.9910, "state": "Uttar Pradesh", "constituency": "Lucknow", "category": "Pollution", "need_type": "Water Pollution", "urgency": "High", "text": "Untreated sewage is visibly flowing into the Gomti near Marine Drive. The water hyacinth has covered the entire surface.", "entities": ["Gomti", "Marine Drive", "sewage", "water hyacinth"]},
        {"ward": "Hazratganj", "lat": 26.8505, "lng": 80.9390, "state": "Uttar Pradesh", "constituency": "Lucknow", "category": "Traffic and Road Safety", "need_type": "Traffic Management", "urgency": "High", "text": "E-rickshaws have completely hijacked the Hazratganj crossing. They stop in the middle of the road blocking all traffic.", "entities": ["Hazratganj", "E-rickshaws", "traffic"]},
        {"ward": "Hazratganj", "lat": 26.8500, "lng": 80.9380, "state": "Uttar Pradesh", "constituency": "Lucknow", "category": "Traffic and Road Safety", "need_type": "Illegal Parking", "urgency": "Medium", "text": "Despite multi-level parking, VIP cars are parked on the main Janpath market road, causing a massive bottleneck.", "entities": ["Janpath", "VIP cars", "parking"]},
        {"ward": "Alambagh", "lat": 26.8166, "lng": 80.9000, "state": "Uttar Pradesh", "constituency": "Lucknow", "category": "Mobility - Roads, Footpaths and Infrastructure", "need_type": "Road Repair", "urgency": "High", "text": "Kanpur road near Alambagh bus stand is broken. Dust pollution is immense due to the gravel on the road.", "entities": ["Alambagh", "Kanpur road", "dust"]},
        {"ward": "Aminabad", "lat": 26.8450, "lng": 80.9250, "state": "Uttar Pradesh", "constituency": "Lucknow", "category": "Electricity and Power Supply", "need_type": "Transformer Repair", "urgency": "Critical", "text": "The local transformer in Aminabad market caught fire last night. Half the market is without power, LESA hasn't responded.", "entities": ["Aminabad", "transformer", "LESA"]},
        {"ward": "Indira Nagar", "lat": 26.8790, "lng": 80.9990, "state": "Uttar Pradesh", "constituency": "Lucknow", "category": "Crime and Safety", "need_type": "Patrolling", "urgency": "High", "text": "Frequent chain snatching incidents reported in Munshi Pulia sector 16. We need active police patrolling in the evenings.", "entities": ["Munshi Pulia", "chain snatching", "police"]},
        {"ward": "Gomti Nagar Extension", "lat": 26.8300, "lng": 81.0100, "state": "Uttar Pradesh", "constituency": "Lucknow", "category": "Water Supply and Services", "need_type": "Water Pressure", "urgency": "Medium", "text": "Water pressure is so low in Gomti Nagar Ext that it doesn't even reach the first floor. Jal Sansthan must investigate.", "entities": ["Gomti Nagar Ext", "water pressure", "Jal Sansthan"]},

        # --- WAYANAD (Kerala) ---
        {"ward": "Mananthavady", "lat": 11.8000, "lng": 76.0000, "state": "Kerala", "constituency": "Wayanad", "category": "Animal Husbandry", "need_type": "Wildlife Conflict", "urgency": "Critical", "text": "A herd of wild elephants entered Thondarnadu village last night, completely destroying the plantain and arecanut crops. Forest department fencing is broken.", "entities": ["elephants", "Thondarnadu", "crops", "forest department"]},
        {"ward": "Mananthavady", "lat": 11.8010, "lng": 76.0010, "state": "Kerala", "constituency": "Wayanad", "category": "Animal Husbandry", "need_type": "Wildlife Conflict", "urgency": "Critical", "text": "Leopard sighted near the tribal colony in Thirunelly. Mothers are scared to send kids to the Anganwadi. We need tranquilizer darts and capture.", "entities": ["Leopard", "Thirunelly", "Anganwadi"]},
        {"ward": "Vythiri", "lat": 11.5500, "lng": 76.0400, "state": "Kerala", "constituency": "Wayanad", "category": "Disaster Management", "need_type": "Landslide Risk", "urgency": "High", "text": "Heavy rains have caused a minor mudslip near the Ghat road in Vythiri. If the rain continues, the entire highway to Kozhikode will be blocked.", "entities": ["Vythiri", "mudslip", "Ghat road"]},
        {"ward": "Vythiri", "lat": 11.5510, "lng": 76.0410, "state": "Kerala", "constituency": "Wayanad", "category": "Disaster Management", "need_type": "Drainage", "urgency": "Medium", "text": "Storm water drains are blocked with debris. Water is flooding into low-lying houses in Pookode.", "entities": ["Pookode", "flooding", "drains"]},
        {"ward": "Kalpetta", "lat": 11.6100, "lng": 76.0830, "state": "Kerala", "constituency": "Wayanad", "category": "Public Health and Healthcare Infrastructure", "need_type": "Doctor Shortage", "urgency": "Critical", "text": "The Kalpetta General Hospital lacks a full-time pediatrician. For any serious child illness, we are forced to travel 70km to Kozhikode.", "entities": ["Kalpetta General Hospital", "pediatrician", "Kozhikode"]},
        {"ward": "Kalpetta", "lat": 11.6110, "lng": 76.0840, "state": "Kerala", "constituency": "Wayanad", "category": "Public Health and Healthcare Infrastructure", "need_type": "Medicine Shortage", "urgency": "High", "text": "Basic antibiotics and paracetamol are out of stock at the local PHC. Poor tribals cannot afford private pharmacies.", "entities": ["PHC", "medicines", "tribals"]},
        {"ward": "Sulthan Bathery", "lat": 11.6600, "lng": 76.2600, "state": "Kerala", "constituency": "Wayanad", "category": "Agriculture", "need_type": "Crop Disease", "urgency": "High", "text": "Quick wilt disease is destroying pepper vines across Bathery. Agriculture officers haven't visited to offer any fungicide solutions.", "entities": ["Quick wilt", "pepper", "Agriculture officers"]},
        {"ward": "Meenangadi", "lat": 11.6300, "lng": 76.1600, "state": "Kerala", "constituency": "Wayanad", "category": "Mobility - Roads, Footpaths and Infrastructure", "need_type": "Rural Roads", "urgency": "Medium", "text": "The Panchayat road leading to Krishnagiri stadium is untarred and washes away every monsoon. School buses refuse to come here.", "entities": ["Panchayat road", "Krishnagiri", "monsoon"]},
        {"ward": "Ambalavayal", "lat": 11.6200, "lng": 76.2100, "state": "Kerala", "constituency": "Wayanad", "category": "Water Supply and Services", "need_type": "Drinking Water", "urgency": "High", "text": "Jal Jeevan Mission pipes were laid a year ago but there is no water connection yet. Villagers rely on a single contaminated well.", "entities": ["Jal Jeevan Mission", "water connection", "well"]},
        {"ward": "Panamaram", "lat": 11.7400, "lng": 76.0700, "state": "Kerala", "constituency": "Wayanad", "category": "School Infrastructure and Quality", "need_type": "School Roof", "urgency": "High", "text": "The roof of the Govt UP School is leaking heavily. Students have to sit with umbrellas inside the classroom.", "entities": ["Govt UP School", "leaking roof", "students"]},

        # --- NEW DELHI (Delhi) ---
        {"ward": "Connaught Place", "lat": 28.6304, "lng": 77.2177, "state": "Delhi", "constituency": "New Delhi", "category": "Pollution", "need_type": "Air Quality", "urgency": "Critical", "text": "AQI has crossed 450 today. The smog is so thick near India Gate that visibility is zero. Urgent need to deploy anti-smog guns and stop construction.", "entities": ["AQI", "India Gate", "smog", "anti-smog guns"]},
        {"ward": "Connaught Place", "lat": 28.6310, "lng": 77.2180, "state": "Delhi", "constituency": "New Delhi", "category": "Pollution", "need_type": "Air Quality", "urgency": "High", "text": "MCD sweepers are sweeping dry dust into the air at Barakhamba road instead of using water sprinklers, worsening the pollution.", "entities": ["MCD", "Barakhamba road", "dust", "pollution"]},
        {"ward": "Karol Bagh", "lat": 28.6538, "lng": 77.1888, "state": "Delhi", "constituency": "New Delhi", "category": "Traffic and Road Safety", "need_type": "Illegal Parking", "urgency": "High", "text": "Arya Samaj Road in Karol Bagh is fully blocked. Two lanes are occupied by illegal parking by shop owners and hawkers.", "entities": ["Arya Samaj Road", "Karol Bagh", "illegal parking"]},
        {"ward": "Karol Bagh", "lat": 28.6540, "lng": 77.1890, "state": "Delhi", "constituency": "New Delhi", "category": "Mobility - Roads, Footpaths and Infrastructure", "need_type": "Encroachment", "urgency": "Medium", "text": "Pedestrians are forced to walk on the busy street because the entire pavement is encroached by illegal extensions of local shops.", "entities": ["pavement", "encroachment", "shops"]},
        {"ward": "R K Puram", "lat": 28.5650, "lng": 77.1800, "state": "Delhi", "constituency": "New Delhi", "category": "Crime and Safety", "need_type": "Women Safety", "urgency": "Critical", "text": "Streetlights inside R.K. Puram Sector 3 parks are completely non-functional. It feels extremely unsafe for women returning from work in the evening.", "entities": ["R.K. Puram", "Streetlights", "unsafe", "women"]},
        {"ward": "R K Puram", "lat": 28.5660, "lng": 77.1810, "state": "Delhi", "constituency": "New Delhi", "category": "Crime and Safety", "need_type": "Patrolling", "urgency": "High", "text": "Anti-social elements gather near the local market after 9 PM. PCR vans rarely patrol the inner lanes.", "entities": ["PCR vans", "anti-social elements"]},
        {"ward": "Malviya Nagar", "lat": 28.5340, "lng": 77.2070, "state": "Delhi", "constituency": "New Delhi", "category": "Water Supply and Services", "need_type": "Water Supply", "urgency": "Critical", "text": "Delhi Jal Board water supply is erratic. We are getting muddy water for only 30 minutes at 2 AM. Tanker mafia is exploiting residents.", "entities": ["Delhi Jal Board", "muddy water", "Tanker mafia"]},
        {"ward": "Lajpat Nagar", "lat": 28.5670, "lng": 77.2430, "state": "Delhi", "constituency": "New Delhi", "category": "Sanitation", "need_type": "Waste Clearance", "urgency": "High", "text": "The Dhalao (garbage dump) in Central Market is overflowing onto the road. Cows and dogs are scattering it everywhere.", "entities": ["Dhalao", "Central Market", "garbage"]},
        {"ward": "Greater Kailash", "lat": 28.5360, "lng": 77.2390, "state": "Delhi", "constituency": "New Delhi", "category": "Electricity and Power Supply", "need_type": "Voltage Fluctuations", "urgency": "Medium", "text": "Severe voltage fluctuations in GK-1 M Block. Several appliances have burnt out. BSES is not responding to complaints.", "entities": ["voltage", "GK-1", "BSES"]},
        {"ward": "Hauz Khas", "lat": 28.5490, "lng": 77.2000, "state": "Delhi", "constituency": "New Delhi", "category": "Traffic and Road Safety", "need_type": "Traffic Management", "urgency": "High", "text": "Massive traffic jam every evening near Hauz Khas village entry due to valet parking blocking the main road.", "entities": ["Hauz Khas village", "traffic jam", "valet parking"]},

        # --- MUMBAI SOUTH (Maharashtra) ---
        {"ward": "Hindmata", "lat": 19.0150, "lng": 72.8400, "state": "Maharashtra", "constituency": "Mumbai South", "category": "Disaster Management", "need_type": "Flooding", "urgency": "Critical", "text": "Just 30 minutes of rain and Hindmata flyover below area is completely waterlogged. BMC's desilting claims are false. Cars are submerged.", "entities": ["Hindmata", "waterlogged", "BMC", "desilting"]},
        {"ward": "Hindmata", "lat": 19.0160, "lng": 72.8410, "state": "Maharashtra", "constituency": "Mumbai South", "category": "Sanitation", "need_type": "Drain Cleaning", "urgency": "High", "text": "The storm water drains in Dadar East are completely choked with plastic and debris, causing instant flooding.", "entities": ["Dadar East", "drains", "flooding"]},
        {"ward": "Colaba", "lat": 18.9100, "lng": 72.8100, "state": "Maharashtra", "constituency": "Mumbai South", "category": "Mobility - Roads, Footpaths and Infrastructure", "need_type": "Footpath Encroachment", "urgency": "High", "text": "Colaba Causeway footpaths are 100% taken over by illegal hawkers. Pedestrians are forced to walk among zooming BEST buses, causing accidents.", "entities": ["Colaba Causeway", "hawkers", "BEST buses", "pedestrians"]},
        {"ward": "Colaba", "lat": 18.9110, "lng": 72.8110, "state": "Maharashtra", "constituency": "Mumbai South", "category": "Traffic and Road Safety", "need_type": "Traffic Management", "urgency": "Medium", "text": "Tourists park haphazardly near Gateway of India causing a massive bottleneck extending all the way to Regal Cinema.", "entities": ["Gateway of India", "Regal Cinema", "parking"]},
        {"ward": "Worli", "lat": 19.0150, "lng": 72.8150, "state": "Maharashtra", "constituency": "Mumbai South", "category": "Water Supply and Services", "need_type": "Contaminated Water", "urgency": "Critical", "text": "BMC pipeline in Worli Koliwada seems to have mixed with a sewer line. Foul smelling, yellowish water is coming from the taps. Kids are falling sick.", "entities": ["BMC pipeline", "Worli Koliwada", "sewer line", "sick"]},
        {"ward": "Worli", "lat": 19.0160, "lng": 72.8160, "state": "Maharashtra", "constituency": "Mumbai South", "category": "Water Supply and Services", "need_type": "Water Cuts", "urgency": "High", "text": "Unannounced 15% water cut implemented in Worli. Slum dwellers are suffering without any backup tanks.", "entities": ["water cut", "Worli", "slums"]},
        {"ward": "Malabar Hill", "lat": 18.9550, "lng": 72.7950, "state": "Maharashtra", "constituency": "Mumbai South", "category": "Pollution", "need_type": "Noise Pollution", "urgency": "Medium", "text": "Constant heavy drilling and construction noise throughout the night from the coastal road project. Senior citizens cannot sleep.", "entities": ["coastal road project", "noise", "senior citizens"]},
        {"ward": "Tardeo", "lat": 18.9690, "lng": 72.8140, "state": "Maharashtra", "constituency": "Mumbai South", "category": "Mobility - Roads, Footpaths and Infrastructure", "need_type": "Pothole Repair", "urgency": "High", "text": "Massive potholes on Tardeo road near AC market. Two-wheelers are skidding daily due to the uneven paver blocks.", "entities": ["Tardeo road", "potholes", "paver blocks"]},
        {"ward": "Byculla", "lat": 18.9750, "lng": 72.8350, "state": "Maharashtra", "constituency": "Mumbai South", "category": "Crime and Safety", "need_type": "Drug Menace", "urgency": "Critical", "text": "Open drug peddling near Byculla station east side at night. Addicts are harassing locals and snatching phones. Police must raid.", "entities": ["Byculla station", "drug peddling", "Police"]},
        {"ward": "Marine Drive", "lat": 18.9440, "lng": 72.8230, "state": "Maharashtra", "constituency": "Mumbai South", "category": "Sanitation", "need_type": "Littering", "urgency": "Medium", "text": "Marine Drive promenade is littered with plastic bottles and food waste by late-night crowds. BMC sweepers are insufficient.", "entities": ["Marine Drive", "littering", "BMC"]}
    ]

    submissions = []
    for i, d in enumerate(base_data):
        submissions.append({
            "id": str(uuid.uuid4()),
            "timestamp": "2026-07-05T10:00:00Z",
            "channel": random.choice(["web", "whatsapp"]),
            "raw_text": d["text"],
            "normalized_text_en": d["text"],
            "language": "English",
            "geo": {"lat": d["lat"], "lng": d["lng"], "ward": d["ward"]},
            "citizen_id_hash": f"cit-nationwide-{i}",
            "state": d["state"],
            "constituency": d["constituency"],
            "category": d["category"],
            "need_type": d["need_type"],
            "urgency": d["urgency"],
            "sentiment": "concerned",
            "canonical_location": d["ward"],
            "extracted_entities": d["entities"]
        })
    
    return submissions

def run_seed():
    print("🚀 Seeding Nationwide Base Dataset for Echo-Merge Demo...")
    db = DBClient()
    
    # 1. Clear database completely to start fresh for demo
    print("🧹 Wiping previous database state...")
    db.submissions = {}
    db.enriched_submissions = {}
    db.embeddings = {}
    db.priorities = []
    db._save_local_backup()
    
    generate_mock_public_data(db)
    
    submissions = generate_multi_constituency_submissions()
    print(f"📦 Generating {len(submissions)} base complaints...")
    
    pipeline = EmbeddingPipeline(db)
    for sub in submissions:
        pipeline.process_and_store_submission(sub)
        
    scoring = ScoringPipelineV2(db)
    planner = SolutionPlanner()
    notifier = NotificationService(db)
    
    constituencies = ["Bengaluru South", "Lucknow", "Wayanad", "New Delhi", "Mumbai South"]
    
    for c in constituencies:
        print(f"\n⚡ Processing {c}...")
        priorities = scoring.run_priority_generation_v2(constituency=c)
        
        for item in priorities:
            category = item["category"]
            need_type = item["title"]
            ward = item["hotspot_geo"]["ward"]
            demo = db.get_demographics(c, ward) or {}
            
            summary_texts = [e["normalized_text_en"] for e in item["supporting_evidence"]]
            summary = " | ".join(summary_texts)
            
            plan = planner.generate_solution_plan(category, need_type, ward, demo, summary)
            item["solution_plan"] = plan
            item["state"] = item.get("state", [s for s in submissions if s["constituency"] == c][0]["state"])
            item["constituency"] = c
            db.insert_priority_item(item)
            
        print(f"✅ Generated solution plans and compiled digest for {c}.")
        notifier.compile_and_send_mp_digest(c, priorities)
        
    print("\n✅ Nationwide database seeded successfully! Ready for Demo.")

if __name__ == "__main__":
    run_seed()
