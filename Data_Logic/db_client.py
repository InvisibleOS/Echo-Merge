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
        self.embeddings = {}  # submission_id -> np.ndarray
        self.demographics = {}  # ward -> dict
        self.facilities = []    # list of dicts
        
        # Paths for local file backup
        self.local_dir = os.path.dirname(os.path.abspath(__file__))
        self.backup_path = os.path.join(self.local_dir, "local_db_backup.json")
        
        if self.db_url:
            try:
                import psycopg2
                self.conn = psycopg2.connect(self.db_url)
                self.is_postgres = True
                print("🔌 Connected to PostgreSQL database successfully.")
                self._init_db_schema()
            except Exception as e:
                print(f"⚠️ Failed to connect to PostgreSQL ({e}). Falling back to local memory database.")
                self.is_postgres = False
                self._load_local_backup()
        else:
            print("ℹ️ DATABASE_URL not set. Using local memory database.")
            self._load_local_backup()

    def _init_db_schema(self):
        """Initializes tables in PostgreSQL."""
        with self.conn.cursor() as cur:
            # Enable vector extension
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            
            # Submissions table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS submissions (
                    id VARCHAR(50) PRIMARY KEY,
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    channel VARCHAR(20) DEFAULT 'web',
                    raw_text TEXT,
                    normalized_text_en TEXT,
                    language VARCHAR(10),
                    latitude DOUBLE PRECISION,
                    longitude DOUBLE PRECISION,
                    ward VARCHAR(100),
                    citizen_id_hash VARCHAR(64),
                    category VARCHAR(100),
                    need_type VARCHAR(100),
                    urgency VARCHAR(20),
                    sentiment VARCHAR(20),
                    canonical_location VARCHAR(200),
                    extracted_entities TEXT[]
                );
            """)
            
            # Embeddings table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS submission_embeddings (
                    submission_id VARCHAR(50) PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,
                    embedding vector(768)
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
            print("✅ Database schema initialized successfully.")

    def _load_local_backup(self):
        """Loads data from a local JSON file if it exists."""
        if os.path.exists(self.backup_path):
            try:
                with open(self.backup_path, 'r', encoding='utf-8') as f:
                    backup = json.load(f)
                    self.submissions = backup.get("submissions", {})
                    self.demographics = backup.get("demographics", {})
                    self.facilities = backup.get("facilities", [])
                    
                    # Convert list back to numpy array for embeddings
                    raw_embeds = backup.get("embeddings", {})
                    self.embeddings = {k: np.array(v) for k, v in raw_embeds.items()}
                print(f"💾 Loaded {len(self.submissions)} submissions from local backup.")
            except Exception as e:
                print(f"⚠️ Failed to load local backup ({e}). Starting fresh.")

    def _save_local_backup(self):
        """Saves current state to local JSON file."""
        if self.is_postgres:
            return
        try:
            backup = {
                "submissions": self.submissions,
                "embeddings": {k: v.tolist() for k, v in self.embeddings.items()},
                "demographics": self.demographics,
                "facilities": self.facilities
            }
            with open(self.backup_path, 'w', encoding='utf-8') as f:
                json.dump(backup, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"⚠️ Failed to write local backup ({e})")

    # API Methods

    def insert_submission(self, sub: dict):
        """Inserts a submission into the DB."""
        if self.is_postgres:
            with self.conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO submissions (
                        id, timestamp, channel, raw_text, normalized_text_en, language,
                        latitude, longitude, ward, citizen_id_hash, category,
                        need_type, urgency, sentiment, canonical_location, extracted_entities
                    ) VALUES (
                        %(id)s, %(timestamp)s, %(channel)s, %(raw_text)s, %(normalized_text_en)s, %(language)s,
                        %(geo)s.lat, %(geo)s.lng, %(geo)s.ward, %(citizen_id_hash)s, %(category)s,
                        %(need_type)s, %(urgency)s, %(sentiment)s, %(canonical_location)s, %(extracted_entities)s
                    ) ON CONFLICT (id) DO UPDATE SET
                        raw_text = EXCLUDED.raw_text,
                        normalized_text_en = EXCLUDED.normalized_text_en,
                        urgency = EXCLUDED.urgency,
                        sentiment = EXCLUDED.sentiment,
                        canonical_location = EXCLUDED.canonical_location;
                """, {
                    'id': sub['id'],
                    'timestamp': sub.get('timestamp'),
                    'channel': sub.get('channel', 'web'),
                    'raw_text': sub.get('raw_text'),
                    'normalized_text_en': sub.get('normalized_text_en'),
                    'language': sub.get('language'),
                    'geo': sub.get('geo', {'lat': None, 'lng': None, 'ward': None}),
                    'citizen_id_hash': sub.get('citizen_id_hash'),
                    'category': sub.get('category'),
                    'need_type': sub.get('need_type'),
                    'urgency': sub.get('urgency'),
                    'sentiment': sub.get('sentiment'),
                    'canonical_location': sub.get('canonical_location'),
                    'extracted_entities': sub.get('extracted_entities', [])
                })
                self.conn.commit()
        else:
            self.submissions[sub['id']] = sub
            self._save_local_backup()

    def insert_embedding(self, submission_id: str, embedding: np.ndarray):
        """Inserts an embedding vector into the DB."""
        if self.is_postgres:
            with self.conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO submission_embeddings (submission_id, embedding)
                    VALUES (%s, %s)
                    ON CONFLICT (submission_id) DO UPDATE SET embedding = EXCLUDED.embedding;
                """, (submission_id, embedding.tolist()))
                self.conn.commit()
        else:
            self.embeddings[submission_id] = embedding
            self._save_local_backup()

    def get_submissions(self) -> list:
        """Returns all submissions."""
        if self.is_postgres:
            with self.conn.cursor() as cur:
                cur.execute("SELECT * FROM submissions;")
                columns = [col[0] for col in cur.description]
                results = []
                for row in cur.fetchall():
                    row_dict = dict(zip(columns, row))
                    # Reconstruct geo object to match contract
                    row_dict['geo'] = {
                        'lat': row_dict.pop('latitude'),
                        'lng': row_dict.pop('longitude'),
                        'ward': row_dict.pop('ward')
                    }
                    results.append(row_dict)
                return results
        else:
            return list(self.submissions.values())

    def get_submission(self, sub_id: str) -> dict:
        """Returns a single submission by ID."""
        if self.is_postgres:
            with self.conn.cursor() as cur:
                cur.execute("SELECT * FROM submissions WHERE id = %s;", (sub_id,))
                row = cur.fetchone()
                if row:
                    columns = [col[0] for col in cur.description]
                    row_dict = dict(zip(columns, row))
                    row_dict['geo'] = {
                        'lat': row_dict.pop('latitude'),
                        'lng': row_dict.pop('longitude'),
                        'ward': row_dict.pop('ward')
                    }
                    return row_dict
                return None
        else:
            return self.submissions.get(sub_id)

    def query_nearest_neighbors(self, query_vector: np.ndarray, limit: int = 5, distance_threshold: float = 0.15) -> list:
        """Queries nearest neighbor submissions within a distance threshold.
        Returns a list of tuples: (submission_id, distance) where distance <= distance_threshold.
        Distance threshold of 0.15 matches cosine distance (i.e. similarity >= 0.85).
        """
        results = []
        if self.is_postgres:
            with self.conn.cursor() as cur:
                # pgvector <=> operator computes cosine distance
                cur.execute("""
                    SELECT submission_id, embedding <=> %s::vector AS distance
                    FROM submission_embeddings
                    WHERE (embedding <=> %s::vector) <= %s
                    ORDER BY distance ASC
                    LIMIT %s;
                """, (query_vector.tolist(), query_vector.tolist(), distance_threshold, limit))
                results = cur.fetchall()
        else:
            # Local numpy calculation
            # Cosine distance = 1 - Cosine Similarity
            # Cosine Similarity = A . B / (||A|| ||B||)
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
            
            # Sort by distance ascending and slice top limit
            temp_results.sort(key=lambda x: x[1])
            results = temp_results[:limit]
            
        return results

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
            # Prevent duplicates in local memory list
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
