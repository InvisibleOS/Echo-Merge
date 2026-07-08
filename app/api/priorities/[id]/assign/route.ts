import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../../../utils/supabase/server';
import { invalidate, CACHE_KEYS } from '../../../../../lib/server/cache';

export const dynamic = 'force-dynamic';

function mapAgencyToDeptId(agencyName: string): string {
  const name = agencyName.toLowerCase();
  if (name.includes("water") || name.includes("bwssb")) return "dept-water";
  if (name.includes("pwd") || name.includes("road") || name.includes("infrastructure") || name.includes("contractor")) return "dept-pwd";
  if (name.includes("solid waste") || name.includes("swm") || name.includes("garbage") || name.includes("sanitation")) return "dept-solid-waste";
  if (name.includes("electricity") || name.includes("power") || name.includes("bescom")) return "dept-electricity";
  return "dept-safety";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const workId = params.id;
    const body = await request.json().catch(() => ({}));
    const agencyName = typeof body.department === 'string' ? body.department : '';

    if (!workId) {
      return NextResponse.json({ error: 'Missing priority/case ID' }, { status: 400 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ success: true, mock: true }, { status: 200 });
    }

    const deptId = mapAgencyToDeptId(agencyName);
    // The db client is our pg-backed shim (utils/supabase/server.js, plain JS);
    // `as any` keeps this TS route from strict-checking its thenable builder.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Persist the assignment on the PRIORITY itself (in its solution_plan jsonb,
    // mirroring how /resolve stores `resolved`). This is the reliable source of
    // truth: it reflects on the MP dashboard AND the citizen's status tracker
    // even when no `cases` row exists yet for this work_id — which is the common
    // case for citizen-submitted priorities. Without this the status stayed
    // "Open · Pending Action" because the cases UPDATE below matched 0 rows.
    const { data: existingPriority } = await db
      .from('priorities')
      .select('solution_plan')
      .eq('work_id', workId)
      .maybeSingle();
    const mergedPlan = {
      ...(existingPriority?.solution_plan || {}),
      assigned: true,
      assigned_department: agencyName,
      assigned_department_id: deptId,
    };
    const { error: planError } = await db
      .from('priorities')
      // Bump updated_at so this just-assigned work order sorts to the top of the
      // "most recent" delegation queue.
      .update({ solution_plan: mergedPlan, updated_at: new Date().toISOString() })
      .eq('work_id', workId);
    if (planError) {
      throw new Error(planError.message);
    }

    // Best-effort: also flip the cases row (powers the department/workload tabs).
    // A 0-row match here is fine — the priority update above is authoritative.
    await db
      .from('cases')
      .update({
        status: 'Assigned',
        department_id: deptId,
        latest_update: `Delegated task to ${agencyName}.`,
        updated_at: new Date().toISOString()
      })
      .eq('work_id', workId);

    // Best-effort department workload counter; never fail the assignment on it.
    await db.rpc('increment_active_cases', { p_dept_id: deptId });

    invalidate(CACHE_KEYS.hotspots);
    invalidate(CACHE_KEYS.priorities);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Server error: ' + msg }, { status: 500 });
  }
}
