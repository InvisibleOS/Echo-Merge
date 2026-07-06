import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../utils/supabase/server';
import { hotspotFromSubmission, hotspotFromPriority } from '../../../lib/server/mappers';
import { cached, CACHE_KEYS } from '../../../lib/server/cache';
import { getActionHotspots } from '../../../lib/server/action-os';

export const dynamic = 'force-dynamic';

const TTL_MS = 20000;

/**
 * GET /hotspots  (Person 2 -> Person 1)
 * Returns a bare Hotspot[] (contract §1) for the map heatmap. Prefers one point
 * per enriched submission (denser, urgency-weighted); falls back to aggregated
 * priority centroids when no enriched submissions exist yet. Cached ~20s.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const constituency = searchParams.get('constituency') || '';

    if (!isSupabaseConfigured) {
      return NextResponse.json(getActionHotspots({ constituency }), { status: 200 });
    }

    const hotspots = await cached(CACHE_KEYS.hotspots, TTL_MS, async () => {
      const { data: subs, error: subErr } = await supabase
        .from('submissions')
        .select('geo, enriched_submissions ( category, urgency )');
      if (subErr) throw new Error(subErr.message);

      const points = (subs || [])
        .filter((s) => s.geo && s.geo.lat != null && s.geo.lng != null)
        .map((s) => {
          const e = Array.isArray(s.enriched_submissions)
            ? s.enriched_submissions[0]
            : s.enriched_submissions;
          return hotspotFromSubmission({
            geo: s.geo,
            category: e?.category,
            urgency: e?.urgency,
            constituency: s.constituency,
          });
        });

      if (points.length > 0) return points;

      // Fallback: aggregate centroids from priorities.
      const { data: priorities, error: pErr } = await supabase
        .from('priorities')
        .select('category, demand_score, demand_count, hotspot_geo');
      if (pErr) throw new Error(pErr.message);

      return (priorities || [])
        .filter((p) => p.hotspot_geo && p.hotspot_geo.lat != null && p.hotspot_geo.lng != null)
        .map(hotspotFromPriority);
    });

    return NextResponse.json(hotspots, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
