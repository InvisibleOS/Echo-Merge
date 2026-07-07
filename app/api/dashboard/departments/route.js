import { NextResponse } from 'next/server';
import { getDepartmentAnalytics } from '../../../../lib/server/action-os';
import { supabase, isSupabaseConfigured } from '../../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const constituency = searchParams.get('constituency') || 'Bengaluru South';

    if (isSupabaseConfigured) {
      // Query the live departments table from Supabase
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      // Automatically recalculate workload score and recommended action dynamically
      const enriched = (data || []).map(dept => {
        const active = dept.active_cases || 0;
        const breached = dept.sla_breaches || 0;
        
        // Match business logic formula from action-os.js
        const sla_compliance = Math.max(42, Math.round(96 - breached * 11 - active * 1.8));
        const workload_score = Math.min(100, Math.round(active * 8 + 70 * 0.32));
        const recommended_action = breached > 0
          ? 'Escalate overdue field verification today.'
          : active > 8
            ? 'Assign additional field staff for hotspot clearance.'
            : 'Maintain current response cadence.';

        return {
          ...dept,
          sla_compliance,
          workload_score,
          recommended_action
        };
      });

      return NextResponse.json(enriched, { status: 200 });
    }

    return NextResponse.json(getDepartmentAnalytics({ constituency }), { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
