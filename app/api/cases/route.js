import { NextResponse } from 'next/server';
import { getCases } from '../../../lib/server/action-os';
import { supabase, isSupabaseConfigured } from '../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';

    if (isSupabaseConfigured) {
      let query = supabase.from('cases').select('*, department:departments(*)');
      if (status) {
        query = query.eq('status', status);
      }
      query = query.order('priority_score', { ascending: false });
      
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return NextResponse.json(data || [], { status: 200 });
    }

    return NextResponse.json(
      getCases({
        status,
      }),
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Server error: ' + error.message }, { status: 500 });
  }
}
