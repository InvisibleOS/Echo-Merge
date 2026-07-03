import os
import json
import numpy as np

class DBClient:
    def __init__(self):
        self.db_url = os.environ.get("DATABASE_URL")
        self.is_postgres = False
        self.conn = None
        
        # Local fallback data structures
        self.submissions = {}
        self.enriched_submissions = {}
        self.embeddings = {}      # submission_id -> np.ndarray
        self.demographics = {}    # ward -> dict
        self.facilities = []      # list of dicts
        self.priorities = []      # list of dicts
        
        # Paths for local file backup
        self.local_dir = os.path.dirname(os.path.abspath(__file__))
        self.backup_path = os.path.join(self.local_dir, "local_db_backup.json")
        
        if self.db_url:
            try:
                import psycopg2
                self.conn = psycopg2.connect(self.db_url)
                self.is_postgres = True
                print("🔌 Connected to Supabase/PostgreSQL database successfully.")
                self._init_db_schema()
            except Exception as e:
                print(f"⚠️ Failed to connect to PostgreSQL ({e}). Falling back to local memory database.")
                self.is_postgres = False
                self._load_local_backup()
        else:
            print("ℹ️ DATABASE_URL not set. Using local memory database.")
            self._load_local_backup()

    def _init_db_schema(self):
        """Ensures all tables exist in Supabase/PostgreSQL, matching migration sql."""
        with self.conn.cursor() as cur:
            # Enable vector extension
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            
            # Submissions table (Raw)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS submissions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
                    channel TEXT DEFAULT 'web' NOT NULL,
                    raw_text TEXT,
                    audio_url TEXT,
                    photo_url TEXT,
                    language TEXT NOT NULL,
                    geo JSONB,
                    citizen_id_hash TEXT NOT NULL
                );
            """)
            
            # Enriched Submissions table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS enriched_submissions (
                    id UUID PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
                    normalized_text_en TEXT NOT NULL,
                    category TEXT NOT NULL,
                    need_type TEXT NOT NULL,
                    urgency TEXT NOT NULL,
                    sentiment TEXT NOT NULL,
                    canonical_location TEXT,
                    extracted_entities JSONB DEFAULT '{}'::jsonb NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
                );
            """)
            
            # Embeddings table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS embeddings (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    submission_id UUID UNIQUE NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
                    vector vector(768) NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
                );
            """)
            
            # Priorities table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS priorities (
                    work_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title TEXT NOT NULL,
                    category TEXT NOT NULL,
                    demand_score NUMERIC DEFAULT 0.0 NOT NULL,
                    demand_count INTEGER DEFAULT 0 NOT NULL,
                    hotspot_geo JSONB DEFAULT '{}'::jsonb NOT NULL,
                    supporting_evidence JSONB DEFAULT '[]'::jsonb NOT NULL,
                    rank INTEGER,
                    explanation TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
                    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
                );
            """)
            
            # Demographics table
            cur.execute("""
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
            """)
            
            # Facilities table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS public_facilities (
                    id VARCHAR(50) PRIMARY KEY,
                    facility_type VARCHAR(100),
                    name VARCHAR(200),
                    latitude DOUBLE PRECISION,
                    longitude DOUBLE PRECISION,
                    ward VARCHAR(100)
                );
            """)
            self.conn.commit()
            print("✅ Database schema verified/initialized successfully.")

    def _load_local_backup(self):
        """Loads data from a local JSON file if it exists."""
        if os.path.exists(self.backup_path):
            try:
                with open(self.backup_path, 'r', encoding='utf-8') as f:
                    backup = json.load(f)
                    self.submissions = backup.get("submissions", {})
                    self.enriched_submissions = backup.get("enriched_submissions", {})
                    self.demographics = backup.get("demographics", {})
                    self.facilities = backup.get("facilities", [])
                    self.priorities = backup.get("priorities", [])
                    
                    # Convert list back to numpy array for embeddings
                    raw_embeds = backup.get("embeddings", {})
                    self.embeddings = {k: np.array(v) for k, v in raw_embeds.items()}
                print(f"💾 Loaded {len(self.submissions)} submissions and {len(self.priorities)} priorities from local backup.")
            except Exception as e:
                print(f"⚠️ Failed to load local backup ({e}). Starting fresh.")

    def _save_local_backup(self):
        """Saves current state to local JSON file."""
        if self.is_postgres:
            return
        try:
            backup = {
                "submissions": self.submissions,
                "enriched_submissions": self.enriched_submissions,
                "embeddings": {k: v.tolist() for k, v in self.embeddings.items()},
                "demographics": self.demographics,
                "facilities": self.facilities,
                "priorities": self.priorities
            }
            with open(self.backup_path, 'w', encoding='utf-8') as f:
                json.dump(backup, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"⚠️ Failed to write local backup ({e})")

    # API Methods

    def insert_submission(self, sub: dict):
        """Inserts raw and enriched submissions into the respective tables."""
        if self.is_postgres:
            with self.conn.cursor() as cur:
                # 1. Insert into raw submissions
                cur.execute("""
                    INSERT INTO submissions (
                        id, timestamp, channel, raw_text, photo_url, language, geo, citizen_id_hash
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        raw_text = EXCLUDED.raw_text,
                        photo_url = EXCLUDED.photo_url;
                """, (
                    sub['id'],
                    sub.get('timestamp'),
                    sub.get('channel', 'web'),
                    sub.get('raw_text'),
                    sub.get('photo_url'),
                    sub.get('language'),
                    json.dumps(sub.get('geo', {'lat': None, 'lng': None, 'ward': None})),
                    sub.get('citizen_id_hash')
                ))
                
                # 2. Insert into enriched submissions
                cur.execute("""
                    INSERT INTO enriched_submissions (
                        id, normalized_text_en, category, need_type, urgency, sentiment, canonical_location, extracted_entities
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        normalized_text_en = EXCLUDED.normalized_text_en,
                        urgency = EXCLUDED.urgency,
                        sentiment = EXCLUDED.sentiment,
                        canonical_location = EXCLUDED.canonical_location;
                """, (
                    sub['id'],
                    sub.get('normalized_text_en', ''),
                    sub.get('category', ''),
                    sub.get('need_type', ''),
                    sub.get('urgency', ''),
                    sub.get('sentiment', ''),
                    sub.get('canonical_location', ''),
                    json.dumps(sub.get('extracted_entities', []))
                ))
                self.conn.commit()
        else:
            # Reconstruct combined structure locally, but separate metadata
            self.submissions[sub['id']] = sub
            self.enriched_submissions[sub['id']] = {
                'id': sub['id'],
                'normalized_text_en': sub.get('normalized_text_en'),
                'category': sub.get('category'),
                'need_type': sub.get('need_type'),
                'urgency': sub.get('urgency'),
                'sentiment': sub.get('sentiment'),
                'canonical_location': sub.get('canonical_location'),
                'extracted_entities': sub.get('extracted_entities', [])
            }
            self._save_local_backup()

    def insert_embedding(self, submission_id: str, embedding: np.ndarray):
        """Inserts an embedding vector into the embeddings table."""
        if self.is_postgres:
            with self.conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO embeddings (submission_id, vector)
                    VALUES (%s, %s)
                    ON CONFLICT (submission_id) DO UPDATE SET vector = EXCLUDED.vector;
                """, (submission_id, embedding.tolist()))
                self.conn.commit()
        else:
            self.embeddings[submission_id] = embedding
            self._save_local_backup()

    def get_submissions(self) -> list:
        """Returns all combined submissions (raw + enriched) to match our python code needs."""
        if self.is_postgres:
            with self.conn.cursor() as cur:
                cur.execute("""
                    SELECT 
                        s.id, s.timestamp, s.channel, s.raw_text, s.photo_url, s.language, s.geo, s.citizen_id_hash,
                        e.normalized_text_en, e.category, e.need_type, e.urgency, e.sentiment, e.canonical_location, e.extracted_entities
                    FROM submissions s
                    LEFT JOIN enriched_submissions e ON s.id = e.id;
                """)
                columns = [col[0] for col in cur.description]
                results = []
                for row in cur.fetchall():
                    row_dict = dict(zip(columns, row))
                    # Parse JSON structures
                    if isinstance(row_dict['geo'], str):
                        row_dict['geo'] = json.loads(row_dict['geo'])
                    if isinstance(row_dict['extracted_entities'], str):
                        row_dict['extracted_entities'] = json.loads(row_dict['extracted_entities'])
                    results.append(row_dict)
                return results
        else:
            # Reconstruct combined dicts from local memory
            results = []
            for sub_id, sub in self.submissions.items():
                enrich = self.enriched_submissions.get(sub_id, {})
                combined = sub.copy()
                combined.update(enrich)
                results.append(combined)
            return results

    def query_nearest_neighbors(self, query_vector: np.ndarray, limit: int = 5, distance_threshold: float = 0.15) -> list:
        """Queries nearest neighbor submissions within a distance threshold."""
        results = []
        if self.is_postgres:
            with self.conn.cursor() as cur:
                # Supabase table is 'embeddings', column is 'vector'
                cur.execute("""
                    SELECT submission_id, vector <=> %s::vector AS distance
                    FROM embeddings
                    WHERE (vector <=> %s::vector) <= %s
                    ORDER BY distance ASC
                    LIMIT %s;
                """, (query_vector.tolist(), query_vector.tolist(), distance_threshold, limit))
                results = cur.fetchall()
        else:
            q_norm = np.linalg.norm(query_vector)
            if q_norm == 0:
                return []
                
            temp_results = []
            for sub_id, embed in self.embeddings.items():
                e_norm = np.linalg.norm(embed)
                if e_norm == 0:
                    continue
                similarity = np.dot(query_vector, embed) / (q_norm * e_norm)
                distance = 1.0 - similarity
                if distance <= distance_threshold:
                    temp_results.append((sub_id, float(distance)))
            
            temp_results.sort(key=lambda x: x[1])
            results = temp_results[:limit]
            
        return results

    # Priorities CRUD (Next.js Dashboard Integration)

    def clear_priorities(self):
        """Clears existing priorities before uploading a refreshed ranked list."""
        if self.is_postgres:
            with self.conn.cursor() as cur:
                cur.execute("TRUNCATE TABLE priorities;")
                self.conn.commit()
        else:
            self.priorities = []
            self._save_local_backup()

    def insert_priority_item(self, item: dict):
        """Inserts a priority item into the database."""
        # Convert UUID to string/proper format
        work_id = item.get("work_id")
        # Ensure it's a valid UUID string in postgres, otherwise let default trigger
        if self.is_postgres:
            with self.conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO priorities (
                        title, category, demand_score, demand_count, hotspot_geo, supporting_evidence, rank, explanation
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    item['title'],
                    item['category'],
                    item['demand_score'],
                    item['demand_count'],
                    json.dumps(item['hotspot_geo']),
                    json.dumps(item['supporting_evidence']),
                    item['rank'],
                    item['explanation']
                ))
                self.conn.commit()
        else:
            self.priorities.append(item)
            self._save_local_backup()

    # Public Datasets API

    def insert_demographics(self, ward: str, data: dict):
        """Inserts public demographic data for a ward."""
        if self.is_postgres:
            with self.conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO public_demographics (
                        ward, population, median_income, infrastructure_score, marginalized_ratio,
                        student_teacher_ratio_gap, hospital_bed_gap, waste_treatment_gap
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (ward) DO UPDATE SET
                        population = EXCLUDED.population,
                        median_income = EXCLUDED.median_income,
                        infrastructure_score = EXCLUDED.infrastructure_score,
                        marginalized_ratio = EXCLUDED.marginalized_ratio,
                        student_teacher_ratio_gap = EXCLUDED.student_teacher_ratio_gap,
                        hospital_bed_gap = EXCLUDED.hospital_bed_gap,
                        waste_treatment_gap = EXCLUDED.waste_treatment_gap;
                """, (
                    ward, data['population'], data['median_income'], data['infrastructure_score'], data['marginalized_ratio'],
                    data.get('student_teacher_ratio_gap', 0.0), data.get('hospital_bed_gap', 0.0), data.get('waste_treatment_gap', 0.0)
                ))
                self.conn.commit()
        else:
            self.demographics[ward] = data
            self._save_local_backup()

    def get_demographics(self, ward: str) -> dict:
        """Retrieves demographics for a ward."""
        if self.is_postgres:
            with self.conn.cursor() as cur:
                cur.execute("SELECT * FROM public_demographics WHERE ward = %s;", (ward,))
                row = cur.fetchone()
                if row:
                    columns = [col[0] for col in cur.description]
                    return dict(zip(columns, row))
                return None
        else:
            return self.demographics.get(ward)

    def insert_facility(self, facility: dict):
        """Inserts a public facility location."""
        if self.is_postgres:
            with self.conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO public_facilities (id, facility_type, name, latitude, longitude, ward)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        facility_type = EXCLUDED.facility_type,
                        name = EXCLUDED.name,
                        latitude = EXCLUDED.latitude,
                        longitude = EXCLUDED.longitude,
                        ward = EXCLUDED.ward;
                """, (facility['id'], facility['facility_type'], facility['name'], facility['latitude'], facility['longitude'], facility['ward']))
                self.conn.commit()
        else:
            self.facilities = [f for f in self.facilities if f['id'] != facility['id']]
            self.facilities.append(facility)
            self._save_local_backup()

    def get_facilities(self, ward: str = None) -> list:
        """Retrieves facilities, optionally filtered by ward."""
        if self.is_postgres:
            with self.conn.cursor() as cur:
                if ward:
                    cur.execute("SELECT * FROM public_facilities WHERE ward = %s;", (ward,))
                else:
                    cur.execute("SELECT * FROM public_facilities;")
                columns = [col[0] for col in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]
        else:
            if ward:
                return [f for f in self.facilities if f['ward'] == ward]
            return self.facilities
