import { NextResponse } from 'next/server';
import { supabase } from '../../../utils/supabase/server';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        enriched_submissions (
          normalized_text_en,
          category,
          need_type,
          urgency,
          sentiment,
          canonical_location,
          extracted_entities
        )
      `)
      .order('timestamp', { ascending: false });

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
