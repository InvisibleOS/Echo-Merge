-- Day 4 (Person 2 — performance): approximate-nearest-neighbour index so
-- top-k similarity search stays fast as embedding volume grows into the
-- thousands. HNSW gives better recall/latency than IVFFlat for our scale and
-- needs no training step. Uses cosine ops to match match_submissions' `<=>`.
--
-- Safe to run against a populated table; index build is online-ish for our size.
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_hnsw
    ON embeddings
    USING hnsw (vector vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Helps the incremental scorer's category lookups and priority ordering.
CREATE INDEX IF NOT EXISTS idx_priorities_category ON priorities (category);
CREATE INDEX IF NOT EXISTS idx_priorities_rank ON priorities (rank);
