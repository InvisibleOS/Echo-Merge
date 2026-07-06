import { NextResponse } from 'next/server';
import { supabase } from '../../../utils/supabase/server';
import { validateSubmitPayload, contentHash } from '../../../lib/server/validation';
import { persistMedia } from '../../../lib/server/media';
import { runPipeline } from '../../../lib/server/pipeline';

// Route handlers are not cached by default in Next 16 — this is request-time.
export const dynamic = 'force-dynamic';

/**
 * POST /submit  (Person 1 -> Person 2)
 * Accepts a citizen submission, stores it raw, then runs the ingestion pipeline
 * (enrich -> embed -> rescore). Idempotent: identical content from the same
 * citizen returns the original submission_id instead of duplicating.
 * Response: SubmitResponse { success, submission_id, message } — contract §2.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const { ok, errors, value, geoWarning } = validateSubmitPayload(body);
  if (!ok) {
    return NextResponse.json(
      { success: false, error: errors.join(' ') },
      { status: 400 }
    );
  }
  if (geoWarning) console.warn('[submit]', geoWarning);

  const hash = contentHash(value);

  try {
    // --- Idempotency: return the existing row for identical content ---------
    const existing = await findByContentHash(hash);
    if (existing) {
      return NextResponse.json(
        {
          success: true,
          submission_id: existing.id,
          message: 'Duplicate submission; returning the original record.',
        },
        { status: 200 }
      );
    }

    // --- Persist any base64 media to durable URLs --------------------------
    const media = await persistMedia(
      supabase,
      { audio_base64: value.audio_base64, photo_base64: value.photo_base64 },
      hash
    );
    media.warnings.forEach((w) => console.warn('[submit] media:', w));

    // --- Store the raw submission (DB columns only; never the raw base64) ---
    const insertRow = {
      channel: value.channel,
      raw_text: value.raw_text,
      audio_url: value.audio_url || media.audio_url,
      photo_url: value.photo_url || media.photo_url,
      language: value.language,
      geo: value.geo,
      citizen_id_hash: value.citizen_id_hash,
    };
    if (contentHashColumnExists !== false) insertRow.content_hash = hash;

    const { data: rawData, error: rawError } = await supabase
      .from('submissions')
      .insert(insertRow)
      .select()
      .single();

    if (rawError) {
      // Unique-violation race: another request stored the same content first.
      if (isUniqueViolation(rawError)) {
        const winner = await findByContentHash(hash);
        if (winner) {
          return NextResponse.json(
            {
              success: true,
              submission_id: winner.id,
              message: 'Duplicate submission; returning the original record.',
            },
            { status: 200 }
          );
        }
      }
      return NextResponse.json({ success: false, error: rawError.message }, { status: 400 });
    }

    // --- Run the pipeline (enrich -> embed -> rescore) ----------------------
    // Best-effort: the raw submission is already durable; pipeline errors are
    // logged inside runPipeline and never lose the citizen's report.
    await runPipeline(supabase, rawData);

    return NextResponse.json(
      {
        success: true,
        submission_id: rawData.id,
        message: 'Submission received and processed.',
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Server error during ingestion: ' + error.message },
      { status: 500 }
    );
  }
}

// Cache whether the content_hash column exists so we don't repeatedly probe a
// pre-migration database. undefined = unknown, true/false = known.
let contentHashColumnExists;

async function findByContentHash(hash) {
  if (contentHashColumnExists === false) return null;
  const { data, error } = await supabase
    .from('submissions')
    .select('id')
    .eq('content_hash', hash)
    .limit(1)
    .maybeSingle();

  if (error) {
    // 42703 = undefined_column -> schema not migrated yet; disable dedup path.
    if (error.code === '42703' || /content_hash/.test(error.message || '')) {
      contentHashColumnExists = false;
      console.warn('[submit] content_hash column missing; idempotency disabled until migrated.');
      return null;
    }
    throw new Error(error.message);
  }
  contentHashColumnExists = true;
  return data || null;
}

function isUniqueViolation(error) {
  return error && (error.code === '23505' || /duplicate key|unique/i.test(error.message || ''));
}
