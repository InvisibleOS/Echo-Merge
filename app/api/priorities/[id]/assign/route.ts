import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../../../utils/supabase/server';
import { invalidate, CACHE_KEYS } from '../../../../../lib/server/cache';
import { SupabaseClient } from '@supabase/supabase-js';

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
    const db = supabase as unknown as SupabaseClient;

    // Update the cases table status to 'Assigned' and link department ID
    const { error: updateError } = await db
      .from('cases')
      .update({
        status: 'Assigned',
        department_id: deptId,
        latest_update: `Delegated task to ${agencyName}.`,
        updated_at: new Date().toISOString()
      })
      .eq('work_id', workId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Call the increment_active_cases RPC function for the department update
    const { error: rpcError } = await db.rpc('increment_active_cases', {
      p_dept_id: deptId
    });

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    invalidate(CACHE_KEYS.hotspots);
    invalidate(CACHE_KEYS.priorities);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Server error: ' + msg }, { status: 500 });
  }
}
