-- Day 5 (Person 2 — pipeline reliability): make POST /submit idempotent.
-- A stable content fingerprint (sha256 of citizen_id_hash + text/audio/photo +
-- language, computed in lib/server/validation.js) is stored per submission; a
-- partial unique index rejects duplicate content at the database level, so a
-- double-tap or network retry collapses to one row even under a race.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS content_hash TEXT;

COMMENT ON COLUMN submissions.content_hash IS 'sha256 fingerprint of citizen + content used to dedupe re-submissions (idempotency).';

-- Partial unique: legacy rows with NULL content_hash are unaffected; only
-- populated hashes must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS uq_submissions_content_hash
    ON submissions (content_hash)
    WHERE content_hash IS NOT NULL;
