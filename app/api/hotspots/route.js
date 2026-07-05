import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const constituency = searchParams.get('constituency');

    const dbPath = path.join(process.cwd(), 'Data_Logic', 'local_db_backup.json');
    
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json([], { status: 200 });
    }

    const fileContent = fs.readFileSync(dbPath, 'utf-8');
    const db = JSON.parse(fileContent);
    let priorities = db.priorities || [];

    if (constituency) {
      priorities = priorities.filter(p => p.constituency === constituency);
    }

    // Format priorities into hotspots
    const hotspots = priorities
      .filter((p) => p.hotspot_geo && p.hotspot_geo.lat && p.hotspot_geo.lng)
      .map((p) => ({
        work_id: p.work_id,
        title: p.title,
        category: p.category,
        geo: {
          lat: Number(p.hotspot_geo.lat),
          lng: Number(p.hotspot_geo.lng),
        },
        intensity: Math.min(1, (Number(p.hotspot_geo.density || p.demand_count || 1) / 10)),
        demand_count: Number(p.demand_count || p.hotspot_geo.density || 1),
        demand_score: Number(p.demand_score),
      }));

    // lib/api.ts expects an array of Hotspot objects directly.
    return NextResponse.json(hotspots, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}
