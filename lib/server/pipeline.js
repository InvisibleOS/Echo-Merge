import { enrich } from './enrichment.js';
import { embed } from './embedding.js';
import { rescoreForSubmission } from './scoring.js';
import { invalidate } from './cache.js';

/**
 * Ingestion pipeline orchestration (Person 2 — Day 3 "the integration hub").
 *
 *   raw submission (already stored)
 *     -> Person 3 enrichment        -> enriched_submissions
 *     -> Person 4 embedding         -> embeddings (pgvector)
 *     -> incremental rescore        -> priorities
 *     -> invalidate read caches
 *
 * Runs after the raw row is safely persisted, so a failure in any downstream
 * stage degrades gracefully (the citizen's submission is never lost) and is
 * logged for the standup. Returns the enrichment result for the response.
 */
export async function runPipeline(supabase, rawSubmission) {
  const submissionId = rawSubmission.id;

  // 1. Enrichment (Gemini via Person 3's service, or mock).
  const enriched = await enrich(rawSubmission);

  const { error: enrichedErr } = await supabase.from('enriched_submissions').upsert(
    {
      id: submissionId,
      normalized_text_en: enriched.normalized_text_en,
      category: enriched.category,
      need_type: enriched.need_type,
      urgency: enriched.urgency,
      sentiment: enriched.sentiment,
      canonical_location: enriched.canonical_location,
      extracted_entities: enriched.extracted_entities,
    },
    { onConflict: 'id' }
  );
  if (enrichedErr) console.error('[pipeline] save enriched failed:', enrichedErr.message);

  // 2. Embedding on the ENGLISH normalized text (Vertex via Person 4, or mock).
  try {
    const vector = await embed(enriched.normalized_text_en);
    const { error: embErr } = await supabase
      .from('embeddings')
      .upsert({ submission_id: submissionId, vector }, { onConflict: 'submission_id' });
    if (embErr) console.error('[pipeline] save embedding failed:', embErr.message);
  } catch (err) {
    console.error('[pipeline] embedding stage failed:', err.message);
  }

  // 3. Fold into priorities + re-rank. Capture the work_id of the priority this
  //    submission landed in so the citizen's saved complaint can link to it
  //    directly (a stable link that survives supporting_evidence rotation).
  let workId = null;
  try {
    workId = await rescoreForSubmission(supabase, { enriched, submissionId, rawSubmission });
  } catch (err) {
    console.error('[pipeline] rescore stage failed:', err.message);
  }

  // 4. Read caches are now stale.
  invalidate();

  return { enriched, workId };
}
