import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../utils/supabase/server';
import { PROACTIVE_ALERTS } from '../../../lib/proactiveData';

export const dynamic = 'force-dynamic';

// Columns persisted to proactive_alerts (must match the table schema).
const ALERT_COLUMNS = [
  'id', 'source', 'source_tooltip', 'ingestion_type', 'predictive_status', 'title',
  'category', 'priority', 'timestamp', 'geo', 'location_label', 'details',
  'suggested_action', 'department',
];

function toRow(alert) {
  const row = {};
  for (const key of ALERT_COLUMNS) row[key] = alert[key];
  return row;
}

/**
 * GET /proactive — system-detected telemetry alerts across India's metros.
 *
 * The DB migration only seeded Bengaluru. This route self-heals: any multi-city
 * demo alert that is missing from the table AND hasn't already been converted
 * into a work order is persisted, so metros (Mumbai, Delhi, Chennai, Hyderabad…)
 * are both viewable on the map and convertible via convert_proactive_alert
 * (which requires a real row). Converted alerts become PRO_* priorities and are
 * never re-seeded, so "convert removes it" still holds.
 */
export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(PROACTIVE_ALERTS, { status: 200 });
    }

    const { data: dbAlerts, error } = await supabase
      .from('proactive_alerts')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const live = dbAlerts || [];
    const dbIds = new Set(live.map((a) => a.id));

    const missing = PROACTIVE_ALERTS.filter((a) => !dbIds.has(a.id));
    if (missing.length === 0) {
      return NextResponse.json(live, { status: 200 });
    }

    // Exclude alerts already converted into work orders (work_id === alert id).
    const { data: converted } = await supabase
      .from('priorities')
      .select('work_id')
      .like('work_id', 'PRO_%');
    const convertedIds = new Set((converted || []).map((p) => p.work_id));

    const toSeed = missing.filter((a) => !convertedIds.has(a.id));
    if (toSeed.length > 0) {
      const { error: seedErr } = await supabase
        .from('proactive_alerts')
        .upsert(toSeed.map(toRow), { onConflict: 'id', ignoreDuplicates: true });
      if (seedErr) console.error('Failed to seed proactive alerts:', seedErr.message);
    }

    return NextResponse.json([...live, ...toSeed], { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
