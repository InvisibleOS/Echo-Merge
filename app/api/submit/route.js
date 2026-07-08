import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../utils/supabase/server';
import { validateSubmitPayload, contentHash } from '../../../lib/server/validation';
import { persistMedia } from '../../../lib/server/media';
import { runPipeline } from '../../../lib/server/pipeline';
import { processOfflineSubmission } from '../../../lib/server/action-os';

// Route handlers are not cached by default in Next 16 — this is request-time.
export const dynamic = 'force-dynamic';

// How long /submit waits for the enrich→embed→score pipeline before responding.
// The pipeline usually finishes in a few seconds; if an upstream (geocode/LLM) is
// slow we respond anyway — the raw row is already saved and the pipeline keeps
// running in the background — so the citizen is never left hanging.
const PIPELINE_MAX_WAIT_MS = 12000;

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
    if (!isSupabaseConfigured) {
      const processed = await processOfflineSubmission(value, hash);
      return NextResponse.json(
        {
          success: true,
          submission_id: processed.submission.id,
          case_id: processed.case.case_id,
          message: 'Submission received, AI-routed, and queued in offline demo mode.',
          department: processed.department,
          scheme_matches: processed.schemes,
          tracking_url: `/dashboard`,
        },
        { status: 201 }
      );
    }

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
    // The raw submission is already durable, but the MP dashboard reads from the
    // `priorities` table, which this pipeline populates. We AWAIT it (capped) so
    // that by the time the citizen sees the confirmation, the complaint is already
    // scored and visible on the dashboard — closing the "switch over and it's not
    // there yet" gap. The cap guarantees a slow geocode/LLM upstream can't hang the
    // request: on timeout the raw row is still saved and the pipeline finishes in
    // the background. Errors are logged and never lose the citizen's report.
    const pipelinePromise = runPipeline(supabase, rawData).catch((err) => {
      console.error('[Pipeline Error]:', err);
    });
    await Promise.race([
      pipelinePromise,
      new Promise((resolve) => setTimeout(resolve, PIPELINE_MAX_WAIT_MS)),
    ]);

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
