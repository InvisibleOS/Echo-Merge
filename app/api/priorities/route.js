import { NextResponse } from 'next/server';
import { supabase } from '../../../utils/supabase/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'rank';

    let query = supabase.from('priorities').select('*');

    if (sortBy === 'demand_score') {
      query = query.order('demand_score', { ascending: false });
    } else {
      // Default to sorting by rank ascending
      query = query.order('rank', { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Server error: ' + error.message },
      { status: 500 }
    );
  }
}
