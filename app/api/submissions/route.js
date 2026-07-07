import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../utils/supabase/server';
import { toEnrichedSubmission, toPriorityItem } from '../../../lib/server/mappers';
import { getActionSubmissions, getActionPriorities } from '../../../lib/server/action-os';

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

function enrichSubmissionsWithStatus(submissions, priorities) {
  const subStatusMap = {};
  for (const p of priorities) {
    const evidence = Array.isArray(p.supporting_evidence) ? p.supporting_evidence : [];
    for (const e of evidence) {
      const subId = e.submission_id || e.id;
      if (subId) {
        subStatusMap[subId] = {
          status: p.status || (p.solution_plan?.resolved ? 'Resolved' : 'Open'),
          assigned_department: p.assigned_department || p.department?.name || undefined
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
      const priorities = getActionPriorities();
      const submissions = getActionSubmissions();
      if (!workId) {
        const enriched = enrichSubmissionsWithStatus(submissions, priorities);
        return NextResponse.json(enriched, { status: 200 });
      }
      const filtered = submissions.filter((item) => item.work_id === workId || item.id === workId);
      const enriched = enrichSubmissionsWithStatus(filtered, priorities);
      return NextResponse.json(enriched, { status: 200 });
    }

    // 1. Load priorities
    const { data: prioritiesData, error: pErr } = await supabase
      .from('priorities')
      .select('*');
    if (pErr) throw new Error(pErr.message);

    // 2. Load cases to resolve their statuses and department assignments
    const { data: casesData, error: casesErr } = await supabase
      .from('cases')
      .select('work_id, status, department_id');
      
    if (casesErr) {
      console.error('Failed to load cases:', casesErr);
    }
    const cases = casesData || [];

    const priorities = (prioritiesData || []).map((row) => {
      const item = toPriorityItem(row);
      const matchedCase = cases.find((c) => c.work_id === item.work_id);
      if (matchedCase) {
        item.status = matchedCase.status;
        
        // Map department_id to generic city-agnostic names
        let deptName = matchedCase.department_id;
        if (deptName) {
          if (deptName.includes('pwd')) deptName = 'Roads & Infrastructure';
          else if (deptName.includes('water')) deptName = 'Water & Sewerage Board';
          else if (deptName.includes('solid-waste')) deptName = 'Solid Waste Management';
          else if (deptName.includes('electricity')) deptName = 'Power & Electricity Discom';
        }
        item.assigned_department = deptName || undefined;
      } else if (item.solution_plan?.resolved) {
        item.status = 'Resolved';
      } else if (item.solution_plan?.assigned) {
        // Assignment persisted on the priority (no case row yet) — reflect it so
        // the citizen's status tracker shows "Assigned", not "Open · Pending".
        item.status = 'Assigned';
        item.assigned_department = item.solution_plan.assigned_department || undefined;
      } else {
        item.status = 'Open';
      }
      return item;
    });

    if (workId) {
      const ids = await evidenceSubmissionIds(workId);
      if (ids.length === 0) return NextResponse.json([], { status: 200 });

      const { data, error } = await supabase
        .from('submissions')
        .select(ENRICHED_SELECT)
        .in('id', ids);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });

      const mapped = (data || []).map(toEnrichedSubmission);
      const enriched = enrichSubmissionsWithStatus(mapped, priorities);
      return NextResponse.json(enriched, { status: 200 });
    }

    const { data, error } = await supabase
      .from('submissions')
      .select(ENRICHED_SELECT)
      .order('timestamp', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const mapped = (data || []).map(toEnrichedSubmission);
    const enriched = enrichSubmissionsWithStatus(mapped, priorities);
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
