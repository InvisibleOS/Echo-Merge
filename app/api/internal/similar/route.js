import { NextResponse } from 'next/server';
import { supabase } from '../../../../utils/supabase/server';
import { embed, EMBEDDING_DIM } from '../../../../lib/server/embedding';

export const dynamic = 'force-dynamic';

/**
 * POST /api/internal/similar   (Person 2 -> Person 4's RAG)
 * Internal top-k pgvector similarity search over stored embeddings.
 *
 * Body: { text?: string, vector?: number[768], k?: number, threshold?: number }
 *   - Provide `vector` to search by a precomputed embedding, or `text` to have
 *     the backend embed it first (same embedding seam the pipeline uses).
 * Response: { matches: { submission_id, similarity }[] }  (cosine, desc)
 *
 * Backs Person 4's clustering/dedup: "for each new submission, retrieve top-k
 * similar via pgvector to group into themes + dedup."
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const k = clampInt(body.k, 1, 100, 10);
    const threshold = clampFloat(body.threshold, 0, 1, 0.5);

    let vector = body.vector;
    if (!Array.isArray(vector)) {
      if (typeof body.text !== 'string' || !body.text.trim()) {
        return NextResponse.json(
          { error: 'Provide either `vector` (number[768]) or non-empty `text`.' },
          { status: 400 }
        );
      }
      vector = await embed(body.text);
    }

    if (vector.length !== EMBEDDING_DIM) {
      return NextResponse.json(
        { error: `vector must have ${EMBEDDING_DIM} dimensions, got ${vector.length}.` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('match_submissions', {
      query_embedding: vector,
      match_threshold: threshold,
      match_count: k,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ matches: data || [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

function clampInt(v, min, max, dflt) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}
function clampFloat(v, min, max, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}
