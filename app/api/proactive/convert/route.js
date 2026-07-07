import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { id } = await request.json().catch(() => ({}));
    if (!id) {
      return NextResponse.json({ error: 'Missing alert id' }, { status: 400 });
    }

    if (!isSupabaseConfigured) {
      return NextResponse.json({ success: true, mock: true }, { status: 200 });
    }

    const { data, error } = await supabase.rpc('convert_proactive_alert', { p_alert_id: id });
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: Boolean(data) }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
