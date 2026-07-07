import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../utils/supabase/server';
import { PROACTIVE_ALERTS } from '../../../lib/proactiveData';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(PROACTIVE_ALERTS, { status: 200 });
    }

    const { data, error } = await supabase
      .from('proactive_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(data || [], { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
