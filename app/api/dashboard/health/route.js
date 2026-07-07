import { NextResponse } from 'next/server';
import { getConstituencyHealth } from '../../../../lib/server/action-os';
import { supabase, isSupabaseConfigured } from '../../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const constituency = searchParams.get('constituency') || 'Bengaluru South';

    if (isSupabaseConfigured) {
      const { count: openCases, error: e1 } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'Resolved');

      const { count: criticalCases, error: e2 } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('priority_band', 'Critical');

      const { count: slaBreaches, error: e3 } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('sla_status', 'Breached');

      const { count: totalResolved, error: e4 } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Resolved');

      if (e1 || e2 || e3 || e4) throw new Error("Stats query failed");

      const healthIndex = Math.max(
        0,
        Math.min(100, Math.round(82 - (openCases || 0) * 0.5 - (criticalCases || 0) * 1.5 - (slaBreaches || 0) * 2.0 + (totalResolved || 0) * 0.8))
      );

      return NextResponse.json({
        constituency,
        health_index: healthIndex,
        open_cases: openCases || 0,
        critical_cases: criticalCases || 0,
        sla_breaches: slaBreaches || 0,
        resolved_this_week: Math.max(3, totalResolved || 0),
        active_hotspots: 3,
        citizen_trust_score: Math.max(40, Math.min(96, healthIndex + 7)),
        top_issue: 'Garbage and Unsanitary Practices',
        trend_label: healthIndex >= 75 ? 'Stable' : 'Needs intervention',
      }, { status: 200 });
    }

    return NextResponse.json(getConstituencyHealth({ constituency }), { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
