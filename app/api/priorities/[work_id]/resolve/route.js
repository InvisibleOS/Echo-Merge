import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../../../utils/supabase/server';
import { invalidate, CACHE_KEYS } from '../../../../../lib/server/cache';

export const dynamic = 'force-dynamic';

export async function PATCH(request, context) {
  const { work_id } = await context.params;

  if (!isSupabaseConfigured) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('priorities')
    .select('solution_plan')
    .eq('work_id', work_id)
    .single();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const updatedPlan = {
    ...(existing?.solution_plan || {}),
    resolved: true
  };

  const { error } = await supabase
    .from('priorities')
    .update({ solution_plan: updatedPlan })
    .eq('work_id', work_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Instantly invalidate the hotspots cache so the map pin disappears!
  invalidate(CACHE_KEYS.hotspots);
  invalidate(CACHE_KEYS.priorities);

  return NextResponse.json({ success: true }, { status: 200 });
}
