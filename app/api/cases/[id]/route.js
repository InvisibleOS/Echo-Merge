import { NextResponse } from 'next/server';
import { updateCaseStatus } from '../../../../lib/server/action-os';

import { supabase, isSupabaseConfigured } from '../../../../utils/supabase/server';
import { invalidate, CACHE_KEYS } from '../../../../lib/server/cache';

export const dynamic = 'force-dynamic';

export async function PATCH(request, context) {
  const body = await request.json().catch(() => ({}));
  const status = typeof body.status === 'string' ? body.status : 'In Progress';
  const note = typeof body.note === 'string' ? body.note : '';
  const departmentId = typeof body.department_id === 'string' ? body.department_id : '';
  const params = await context.params;
  const { id } = params;

  if (isSupabaseConfigured) {
    const { error: caseError } = await supabase
      .from('cases')
      .update({
        status,
        latest_update: note || `Status changed to ${status}`,
        ...(departmentId ? { department_id: departmentId } : {}),
        updated_at: new Date().toISOString()
      })
      .eq('case_id', id);

    if (caseError) {
      return NextResponse.json({ error: caseError.message }, { status: 500 });
    }

    // If status is Resolved, sync with priorities table
    if (status === 'Resolved') {
      const { data: caseData } = await supabase
        .from('cases')
        .select('work_id')
        .eq('case_id', id)
        .single();
      
      if (caseData?.work_id) {
        const { data: priority } = await supabase
          .from('priorities')
          .select('solution_plan')
          .eq('work_id', caseData.work_id)
          .single();

        const updatedPlan = {
          ...(priority?.solution_plan || {}),
          resolved: true
        };

        await supabase
          .from('priorities')
          .update({ solution_plan: updatedPlan })
          .eq('work_id', caseData.work_id);
      }
    }
    
    // Invalidate caches
    invalidate(CACHE_KEYS.hotspots);
    invalidate(CACHE_KEYS.priorities);

    // Fetch the updated case to return it
    const { data: updatedCase, error: fetchErr } = await supabase
      .from('cases')
      .select('*, department:departments(*)')
      .eq('case_id', id)
      .single();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    return NextResponse.json(updatedCase, { status: 200 });
  }

  const updated = updateCaseStatus(id, status, note, departmentId);
  return NextResponse.json(updated, { status: updated ? 200 : 404 });
}
