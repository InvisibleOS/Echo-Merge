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
      const { data: priorities, error: pErr } = await supabase
        .from('priorities')
        .select('category, demand_score, demand_count, hotspot_geo, supporting_evidence, solution_plan');
      
      if (pErr) throw new Error(pErr.message);

      const activePriorities = (priorities || []).filter(
        (p) => !p.solution_plan?.resolved
      );

      const points = [];

      for (const p of activePriorities) {
        if (p.supporting_evidence && p.supporting_evidence.length > 0) {
          // Add denser points from evidence
          for (const ev of p.supporting_evidence) {
            if (ev.geo && ev.geo.lat != null && ev.geo.lng != null) {
              points.push(hotspotFromSubmission({
                geo: ev.geo,
                category: p.category,
                urgency: 'Medium', // We don't store urgency per evidence currently, so fallback
                constituency: p.hotspot_geo?.ward,
              }));
            }
          }
        } else if (p.hotspot_geo && p.hotspot_geo.lat != null && p.hotspot_geo.lng != null) {
          // Fallback to centroid if no evidence coords
          points.push(hotspotFromPriority(p));
        }
      }

      return points;
    });

    return NextResponse.json(hotspots, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
