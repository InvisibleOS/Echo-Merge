import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../../utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /submissions/media?id=<submission_id>
 * Returns just the media URLs for ONE submission: { photo_url, audio_url }.
 * This is fetched lazily by the complaint views so the heavy media bytes never
 * ride along on the hot /api/priorities payload — they're loaded only when a
 * complaint that actually has an attachment is on screen.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing submission id' }, { status: 400 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ photo_url: null, audio_url: null }, { status: 200 });
  }

  const { data, error } = await supabase
    .from('submissions')
    .select('photo_url, audio_url')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    { photo_url: data?.photo_url ?? null, audio_url: data?.audio_url ?? null },
    { status: 200 }
  );
}
