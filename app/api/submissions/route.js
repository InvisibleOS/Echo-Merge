import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../utils/supabase/server';
import { toEnrichedSubmission } from '../../../lib/server/mappers';
import { getActionSubmissions } from '../../../lib/server/action-os';

export const dynamic = 'force-dynamic';

const ENRICHED_SELECT = `
  *,
  enriched_submissions (
    normalized_text_en,
    category,
    need_type,
    urgency,
    sentiment,
    canonical_location,
    extracted_entities
  )
`;

/**
 * GET /submissions  (Person 2 -> Person 1)
 * Returns a bare EnrichedSubmission[] (raw + translation merged, contract §1),
 * newest first. With ?work_id=<id> it returns only the submissions cited as
 * supporting evidence for that priority (dashboard drill-down).
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const workId = searchParams.get('work_id');

    if (!isSupabaseConfigured) {
      const submissions = getActionSubmissions();
      if (!workId) return NextResponse.json(submissions, { status: 200 });
      return NextResponse.json(
        submissions.filter((item) => item.work_id === workId || item.id === workId),
        { status: 200 }
      );
    }

    if (workId) {
      const ids = await evidenceSubmissionIds(workId);
      if (ids.length === 0) return NextResponse.json([], { status: 200 });

      const { data, error } = await supabase
        .from('submissions')
        .select(ENRICHED_SELECT)
        .in('id', ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      return NextResponse.json((data || []).map(toEnrichedSubmission), { status: 200 });
    }

    const { data, error } = await supabase
      .from('submissions')
      .select(ENRICHED_SELECT)
      .order('timestamp', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json((data || []).map(toEnrichedSubmission), { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}

/** Resolve a priority's supporting_evidence -> submission ids for drill-down. */
async function evidenceSubmissionIds(workId) {
  const { data, error } = await supabase
    .from('priorities')
    .select('supporting_evidence')
    .eq('work_id', workId)
    .maybeSingle();
  if (error || !data || !Array.isArray(data.supporting_evidence)) return [];
  return data.supporting_evidence
    .map((e) => e && (e.submission_id ?? e.id))
    .filter(Boolean);
}
