import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../utils/supabase/server';
import { toPriorityItem } from '../../../lib/server/mappers';
import { cached, CACHE_KEYS } from '../../../lib/server/cache';
import { getActionPriorities } from '../../../lib/server/action-os';

export const dynamic = 'force-dynamic';

const TTL_MS = 20000;

/**
 * GET /priorities  (Person 2 -> Person 1)
 * Returns a bare PriorityItem[] (contract §2), ranked. Cached ~20s and
 * invalidated on each processed submission.
 * Query: ?sortBy=rank (default) | demand_score
 */
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
      const mapped = (data || []).map(toPriorityItem);
      return constituency
        ? mapped.filter((item) => (item.hotspot_geo?.ward || '').includes(constituency))
        : mapped;
    });

    return NextResponse.json(items, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
