import sys
import os
import uuid
import random

# Add parent directory to path so we can import DBClient
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from db_client import DBClient

def generate_mock_public_data(db_client: DBClient):
    print("🏙️ Seeding nationwide mock public datasets...")
    
    # 1. MP Directory Seeding
    mps_data = [
        {"constituency": "Bengaluru South", "state": "Karnataka", "mp_name": "Tejasvi Surya", "mp_email": "tejasvi.surya@sansad.nic.in"},
        {"constituency": "Lucknow", "state": "Uttar Pradesh", "mp_name": "Rajnath Singh", "mp_email": "rajnath.singh@sansad.nic.in"},
        {"constituency": "Wayanad", "state": "Kerala", "mp_name": "Priyanka Gandhi", "mp_email": "priyanka.gandhi@sansad.nic.in"}
    ]
    
    for mp in mps_data:
        db_client.insert_mp(mp["constituency"], mp["state"], mp["mp_name"], mp["mp_email"])
        print(f"  - MP Directory seeded: {mp['mp_name']} ({mp['constituency']})")
        
    # 2. Demographic data mapping (constituency, ward) -> demographics
    demographics_to_seed = {
        "Bengaluru South": {
            "HSR Layout": {
                "state": "Karnataka",
                "population": 120000,
                "median_income": 85000,
                "infrastructure_score": 0.85,
                "marginalized_ratio": 0.10,
                "student_teacher_ratio_gap": 0.10,
                "hospital_bed_gap": 0.08,
                "waste_treatment_gap": 0.12
            },
            "Bellandur": {
                "state": "Karnataka",
                "population": 150000,
                "median_income": 95000,
                "infrastructure_score": 0.70,
                "marginalized_ratio": 0.15,
                "student_teacher_ratio_gap": 0.20,
                "hospital_bed_gap": 0.35,
                "waste_treatment_gap": 0.45
            },
            "BTM Layout": {
                "state": "Karnataka",
                "population": 160000,
                "median_income": 60000,
                "infrastructure_score": 0.65,
                "marginalized_ratio": 0.20,
                "student_teacher_ratio_gap": 0.35,
                "hospital_bed_gap": 0.25,
                "waste_treatment_gap": 0.30
            },
            "Global": {
                "state": "Karnataka",
                "population": 940000,
                "median_income": 68000,
                "infrastructure_score": 0.68,
                "marginalized_ratio": 0.20,
                "student_teacher_ratio_gap": 0.30,
                "hospital_bed_gap": 0.30,
                "waste_treatment_gap": 0.35
            }
        },
        "Lucknow": {
            "Hazratganj": {
                "state": "Uttar Pradesh",
                "population": 80000,
                "median_income": 70000,
                "infrastructure_score": 0.80,
                "marginalized_ratio": 0.12,
                "student_teacher_ratio_gap": 0.15,
                "hospital_bed_gap": 0.12,
                "waste_treatment_gap": 0.20
            },
            "Chowk": {
                "state": "Uttar Pradesh",
                "population": 210000,
                "median_income": 30000,
                "infrastructure_score": 0.50,
                "marginalized_ratio": 0.35,
                "student_teacher_ratio_gap": 0.65,
                "hospital_bed_gap": 0.70,
                "waste_treatment_gap": 0.75
            },
            "Global": {
                "state": "Uttar Pradesh",
                "population": 2900000,
                "median_income": 45000,
                "infrastructure_score": 0.60,
                "marginalized_ratio": 0.25,
                "student_teacher_ratio_gap": 0.40,
                "hospital_bed_gap": 0.50,
                "waste_treatment_gap": 0.55
            }
        },
        "Wayanad": {
            "Kalpetta": {
                "state": "Kerala",
                "population": 45000,
                "median_income": 50000,
                "infrastructure_score": 0.75,
                "marginalized_ratio": 0.18,
                "student_teacher_ratio_gap": 0.08,
                "hospital_bed_gap": 0.15,
                "waste_treatment_gap": 0.25
            },
            "Mananthavady": {
                "state": "Kerala",
                "population": 65000,
                "median_income": 35000,
                "infrastructure_score": 0.55,
                "marginalized_ratio": 0.40,
                "student_teacher_ratio_gap": 0.25,
                "hospital_bed_gap": 0.50,
                "waste_treatment_gap": 0.60
            },
            "Global": {
                "state": "Kerala",
                "population": 810000,
                "median_income": 42000,
                "infrastructure_score": 0.65,
                "marginalized_ratio": 0.30,
                "student_teacher_ratio_gap": 0.18,
                "hospital_bed_gap": 0.30,
                "waste_treatment_gap": 0.40
            }
        }
    }
    
    for constituency, wards in demographics_to_seed.items():
        for ward, data in wards.items():
            db_client.insert_demographics(constituency, ward, data)
            print(f"  - Demographics seeded: {constituency} -> {ward}")

    # 3. Public Facilities Seeding (Bengaluru South focus for backward compatibility)
    facility_types = ["Primary School", "Government High School", "Public Health Center", "Water Tanker Station", "Waste Management Center"]
    ward_coordinates = {
        "HSR Layout": (12.9116, 77.6389),
        "Bellandur": (12.9304, 77.6784),
        "BTM Layout": (12.9166, 77.6101)
    }

    count = 0
    for ward, center in ward_coordinates.items():
        for f_type in facility_types:
            lat = center[0] + random.uniform(-0.01, 0.01)
            lng = center[1] + random.uniform(-0.01, 0.01)
            facility_id = f"fac-{count}"
            facility = {
                "id": facility_id,
                "facility_type": f_type,
                "name": f"Bengaluru South {ward} {f_type}",
                "latitude": lat,
                "longitude": lng,
                "ward": ward,
                "constituency": "Bengaluru South"
            }
            db_client.insert_facility(facility)
            count += 1
            
    print(f"✅ Generated {count} mock public facilities.")
