import { NextResponse } from 'next/server';
import { reverseGeocode } from '../../../lib/server/enrichment';

export const dynamic = 'force-dynamic';

/**
 * GET /geocode?lat=<lat>&lng=<lng>
 * Reverse-geocodes a coordinate to a human-facing city/town/village name using
 * the same Google Geocoding path the enrichment pipeline uses (server-side key,
 * in-process cache). Used by the citizen status tracker to show a place name
 * instead of raw coordinates. Returns { label: string | null }.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng are required numbers' }, { status: 400 });
  }

  try {
    const label = await reverseGeocode(lat, lng);
    return NextResponse.json({ label: label || null }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ label: null, error: String(error?.message || error) }, { status: 200 });
  }
}
