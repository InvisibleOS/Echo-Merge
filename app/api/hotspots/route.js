import { NextResponse } from 'next/server';
import { supabase } from '../../../utils/supabase/server';

export async function GET() {
  try {
    // 1. Fetch pre-calculated hotspots from the priorities table
    const { data: priorities, error: pError } = await supabase
      .from('priorities')
      .select('work_id, title, category, hotspot_geo, demand_count, demand_score');

    if (pError) {
      return NextResponse.json({ error: pError.message }, { status: 400 });
    }

    // Format priorities hotspot data. hotspot_geo contains { lat, lng, density }
    const hotspots = priorities
      .filter((p) => p.hotspot_geo && p.hotspot_geo.lat && p.hotspot_geo.lng)
      .map((p) => ({
        work_id: p.work_id,
        title: p.title,
        category: p.category,
        lat: Number(p.hotspot_geo.lat),
        lng: Number(p.hotspot_geo.lng),
        density: Number(p.hotspot_geo.density || p.demand_count || 1),
        demand_score: Number(p.demand_score),
      }));

    // 2. Fetch raw submission coordinates for detailed heatmap aggregation if frontend wants it
    const { data: rawSubmissions, error: sError } = await supabase
      .from('submissions')
      .select('id, geo, channel, timestamp');

    if (sError) {
      return NextResponse.json({ error: sError.message }, { status: 400 });
    }

    const rawGeoPoints = rawSubmissions
      .filter((s) => s.geo && s.geo.lat && s.geo.lng)
      .map((s) => ({
        id: s.id,
        lat: Number(s.geo.lat),
        lng: Number(s.geo.lng),
        channel: s.channel,
        timestamp: s.timestamp,
      }));

    return NextResponse.json(
      {
        hotspots,
        rawGeoPoints,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}
