-- Day 2 (Person 2 owns the schema; Person 4 owns the data that fills it)
-- Public datasets fused into the priority score live in Postgres alongside the
-- citizen submissions so scoring can JOIN them. These mirror the tables the
-- Python data pipeline (Data_Logic/db_client.py) creates on the fly — declaring
-- them here makes the database reproducible from migrations alone.

-- Census / demographic signal, keyed by ward. Drives the equity + gap factors
-- in the priority score (e.g. underserved wards surface even at lower volume).
CREATE TABLE IF NOT EXISTS public_demographics (
    ward VARCHAR(100) PRIMARY KEY,
    population INT,
    median_income INT,
    infrastructure_score FLOAT,
    marginalized_ratio FLOAT,
    student_teacher_ratio_gap FLOAT,
    hospital_bed_gap FLOAT,
    waste_treatment_gap FLOAT
);

COMMENT ON TABLE public_demographics IS 'Per-ward public/demographic data (census, UDISE gaps) fused into priority scoring.';

-- Amenities / infrastructure inventory used for feasibility + distance weighting
-- (e.g. weight a "new school" request by nearby existing schools).
CREATE TABLE IF NOT EXISTS public_facilities (
    id VARCHAR(50) PRIMARY KEY,
    facility_type VARCHAR(100),
    name VARCHAR(200),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    ward VARCHAR(100)
);

COMMENT ON TABLE public_facilities IS 'Public amenities/infrastructure inventory used for feasibility and distance weighting in scoring.';

CREATE INDEX IF NOT EXISTS idx_public_facilities_ward ON public_facilities (ward);
