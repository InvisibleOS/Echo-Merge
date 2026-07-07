import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../utils/supabase/server';
import { toEnrichedSubmission } from '../../../lib/server/mappers';
import { getActionSubmissions, getCases } from '../../../lib/server/action-os';

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

function enrichSubmissionsWithStatus(submissions, cases) {
  const subStatusMap = {};
  for (const c of cases) {
    const evidence = Array.isArray(c.evidence) ? c.evidence : [];
    for (const e of evidence) {
      const subId = e.submission_id || e.id;
      if (subId) {
        subStatusMap[subId] = {
          status: c.status,
          assigned_department: c.department?.name || c.department?.short_name || undefined
        };
      }
    }
  }

  return submissions.map(sub => {
    const matched = subStatusMap[sub.id];
    return {
      ...sub,
      status: matched?.status || 'Open',
      assigned_department: matched?.assigned_department || undefined
    };
  });
}

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
      const cases = getCases();
      const submissions = getActionSubmissions();
      if (!workId) {
        const enriched = enrichSubmissionsWithStatus(submissions, cases);
        return NextResponse.json(enriched, { status: 200 });
      }
      const filtered = submissions.filter((item) => item.work_id === workId || item.id === workId);
      const enriched = enrichSubmissionsWithStatus(filtered, cases);
      return NextResponse.json(enriched, { status: 200 });
    }

    // Load cases to map status
    const { data: casesData } = await supabase
      .from('cases')
      .select('status, evidence, department:departments(name)');
    const cases = casesData || [];

    if (workId) {
      const ids = await evidenceSubmissionIds(workId);
      if (ids.length === 0) return NextResponse.json([], { status: 200 });

      const { data, error } = await supabase
        .from('submissions')
        .select(ENRICHED_SELECT)
        .in('id', ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const mapped = (data || []).map(toEnrichedSubmission);
      const enriched = enrichSubmissionsWithStatus(mapped, cases);
      return NextResponse.json(enriched, { status: 200 });
    }

    const { data, error } = await supabase
      .from('submissions')
      .select(ENRICHED_SELECT)
      .order('timestamp', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const mapped = (data || []).map(toEnrichedSubmission);
    const enriched = enrichSubmissionsWithStatus(mapped, cases);
    return NextResponse.json(enriched, { status: 200 });
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
