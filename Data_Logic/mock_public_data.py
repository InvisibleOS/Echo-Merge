import sys
import os
import uuid
import random

# Add parent directory to path so we can import DBClient
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db_client import DBClient

def generate_mock_public_data(db_client: DBClient):
    print("🏙️ Generating mock public datasets for Bengaluru South wards...")
    
    # 1. Demographic data
    wards_demographics = {
        "HSR Layout": {
            "population": 120000,
            "median_income": 85000,
            "infrastructure_score": 0.85, # Highly developed infrastructure
            "marginalized_ratio": 0.10,
            "student_teacher_ratio_gap": 0.10,
            "hospital_bed_gap": 0.08,
            "waste_treatment_gap": 0.12
        },
        "Bellandur": {
            "population": 150000,
            "median_income": 95000,
            "infrastructure_score": 0.70, # Tech hub but prone to infrastructure/water lags
            "marginalized_ratio": 0.15,
            "student_teacher_ratio_gap": 0.20,
            "hospital_bed_gap": 0.35,
            "waste_treatment_gap": 0.45
        },
        "Koramangala": {
            "population": 180000,
            "median_income": 90000,
            "infrastructure_score": 0.80, # Good amenities, occasional flooding
            "marginalized_ratio": 0.12,
            "student_teacher_ratio_gap": 0.15,
            "hospital_bed_gap": 0.10,
            "waste_treatment_gap": 0.18
        },
        "Jayanagar": {
            "population": 110000,
            "median_income": 75000,
            "infrastructure_score": 0.90, # Excellent green cover and infrastructure
            "marginalized_ratio": 0.08,
            "student_teacher_ratio_gap": 0.05,
            "hospital_bed_gap": 0.05,
            "waste_treatment_gap": 0.05
        },
        "BTM Layout": {
            "population": 160000,
            "median_income": 60000,
            "infrastructure_score": 0.65, # Densely populated student/working hub
            "marginalized_ratio": 0.20,
            "student_teacher_ratio_gap": 0.35,
            "hospital_bed_gap": 0.25,
            "waste_treatment_gap": 0.30
        },
        "Singasandra": {
            "population": 90000,
            "median_income": 40000,
            "infrastructure_score": 0.45, # Rapidly developing, poor primary infrastructure
            "marginalized_ratio": 0.35,
            "student_teacher_ratio_gap": 0.75,
            "hospital_bed_gap": 0.80,
            "waste_treatment_gap": 0.85
        },
        "Begur": {
            "population": 130000,
            "median_income": 35000,
            "infrastructure_score": 0.40, # Densely populated, low infrastructure indices
            "marginalized_ratio": 0.40,
            "student_teacher_ratio_gap": 0.85,
            "hospital_bed_gap": 0.75,
            "waste_treatment_gap": 0.90
        },
        "Bengaluru South": { # Fallback / global constituency average
            "population": 940000,
            "median_income": 68000,
            "infrastructure_score": 0.68,
            "marginalized_ratio": 0.20,
            "student_teacher_ratio_gap": 0.30,
            "hospital_bed_gap": 0.30,
            "waste_treatment_gap": 0.35
        }
    }

    for ward, data in wards_demographics.items():
        db_client.insert_demographics(ward, data)
        print(f"  - Demographics added for ward: {ward}")

    # 2. Public Facilities
    # We will generate mock public schools, water plants, and hospitals
    facility_types = ["Primary School", "Government High School", "Public Health Center", "Water Tanker Station", "Waste Management Center"]
    
    # Wards center coordinates for realistic geo mapping
    ward_coordinates = {
        "HSR Layout": (12.9116, 77.6389),
        "Bellandur": (12.9304, 77.6784),
        "Koramangala": (12.9352, 77.6244),
        "Jayanagar": (12.9250, 77.5938),
        "BTM Layout": (12.9165, 77.6101),
        "Singasandra": (12.8798, 77.6534),
        "Begur": (12.8753, 77.6300),
        "Bengaluru South": (12.9000, 77.6000)
    }
    
    facility_count = 0
    for ward, center in ward_coordinates.items():
        lat, lng = center
        # Create 3-5 facilities per ward
        for i in range(random.randint(3, 5)):
            f_type = random.choice(facility_types)
            # Add small random perturbation to coordinates
            f_lat = lat + random.uniform(-0.01, 0.01)
            f_lng = lng + random.uniform(-0.01, 0.01)
            
            facility = {
                "id": f"FAC-{str(uuid.uuid4())[:8].upper()}",
                "facility_type": f_type,
                "name": f"Govt {f_type} - {ward} (Unit {i+1})",
                "latitude": f_lat,
                "longitude": f_lng,
                "ward": ward
            }
            db_client.insert_facility(facility)
            facility_count += 1
            
    print(f"✅ Generated {facility_count} mock public facilities.")

if __name__ == "__main__":
    db = DBClient()
    generate_mock_public_data(db)
