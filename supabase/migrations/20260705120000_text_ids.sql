-- Day 6 (Person 2 — integration fix): submission and priority ids are STRINGS
-- across the whole system, not UUIDs.
--   * The contract types them as `string` (lib/types.ts).
--   * Real data uses ids like "SUB-BLR-13526" and "PRIORITY-V2-SUB-BLR-599".
--   * Person 4's pipeline (db_client.py) keys on these strings; it only ran in
--     local-file mode because they don't fit the UUID columns.
-- Convert the id columns to TEXT so the real mock data and Person 4's Postgres
-- path work directly, while keeping auto-generation for live web submissions.
--
-- Runs once via the migration tracker. FKs are dropped/re-added because
-- uuid->text is not binary-coercible.

-- 1. Drop dependent foreign keys
ALTER TABLE enriched_submissions DROP CONSTRAINT IF EXISTS enriched_submissions_id_fkey;
ALTER TABLE embeddings DROP CONSTRAINT IF EXISTS embeddings_submission_id_fkey;

-- 2. Convert types (with USING casts) and keep string auto-ids for live inserts
ALTER TABLE submissions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE submissions ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE submissions ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE enriched_submissions ALTER COLUMN id TYPE TEXT USING id::text;

ALTER TABLE embeddings ALTER COLUMN submission_id TYPE TEXT USING submission_id::text;

ALTER TABLE priorities ALTER COLUMN work_id DROP DEFAULT;
ALTER TABLE priorities ALTER COLUMN work_id TYPE TEXT USING work_id::text;
ALTER TABLE priorities ALTER COLUMN work_id SET DEFAULT gen_random_uuid()::text;

-- 3. Re-add foreign keys (text -> text)
ALTER TABLE enriched_submissions
    ADD CONSTRAINT enriched_submissions_id_fkey
    FOREIGN KEY (id) REFERENCES submissions(id) ON DELETE CASCADE;
ALTER TABLE embeddings
    ADD CONSTRAINT embeddings_submission_id_fkey
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE;

-- 4. Recreate the similarity RPC so it returns submission_id as TEXT
DROP FUNCTION IF EXISTS match_submissions(vector, float, int);

CREATE OR REPLACE FUNCTION match_submissions (
    query_embedding vector(768),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    submission_id text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        embeddings.submission_id,
        (1 - (embeddings.vector <=> query_embedding))::float AS similarity
    FROM embeddings
    WHERE (1 - (embeddings.vector <=> query_embedding)) > match_threshold
    ORDER BY embeddings.vector <=> query_embedding ASC
    LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_submissions IS 'pgvector top-k cosine similarity search; returns text submission ids.';
