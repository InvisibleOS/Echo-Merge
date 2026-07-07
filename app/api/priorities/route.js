import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../utils/supabase/server';
import { toPriorityItem } from '../../../lib/server/mappers';
import { cached, CACHE_KEYS } from '../../../lib/server/cache';
import { getActionPriorities } from '../../../lib/server/action-os';

export const dynamic = 'force-dynamic';

const TTL_MS = 1000; // Keep cache low for instant map update feedback

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') === 'demand_score' ? 'demand_score' : 'rank';
    const constituency = searchParams.get('constituency') || '';

    if (!isSupabaseConfigured) {
      return NextResponse.json(getActionPriorities({ constituency, sortBy }), { status: 200 });
    }

    const items = await cached(`${CACHE_KEYS.priorities}:${sortBy}`, TTL_MS, async () => {
      let query = supabase.from('priorities').select('*');
      query =
        sortBy === 'demand_score'
          ? query.order('demand_score', { ascending: false })
          : query.order('rank', { ascending: true, nullsFirst: false });

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      // Fetch all cases to merge their live status and department assignments
      const { data: casesData } = await supabase
        .from('cases')
        .select('case_id, work_id, status, department_id');

      const mapped = (data || []).map((row) => {
        const item = toPriorityItem(row);
        const matchedCase = (casesData || []).find((c) => c.work_id === item.work_id);
        if (matchedCase) {
          item.case_id = matchedCase.case_id;
          item.status = matchedCase.status;
          item.assigned_department = matchedCase.department_id;
        }
        return item;
      });

      // Rank by the AI rating (sum of the four 1–5 dimensions, out of 20). Ties
      // fall back to citizen demand so heavier clusters lead. `sortBy=demand_score`
      // stays a legacy override that ranks purely by raw demand.
      const sorted = [...mapped].sort((a, b) => {
        if (sortBy === 'demand_score') return b.demand_score - a.demand_score;
        const at = a.ai_rating?.total ?? 0;
        const bt = b.ai_rating?.total ?? 0;
        return bt - at || b.demand_score - a.demand_score;
      });
      return sorted.map((item, index) => ({ ...item, rank: index + 1 }));
    });

    return NextResponse.json(items, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
