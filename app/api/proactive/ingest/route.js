import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../../utils/supabase/server';
import { CITIES } from '../../../../lib/cities';
import { buildQueries, classifyArticle, titleSimilar } from '../../../../lib/server/newsIngest';
import { googleWebSearch, isGoogleSearchConfigured } from '../../../../lib/server/googleSearch';

export const dynamic = 'force-dynamic';

const ALERT_COLUMNS = [
  'id', 'source', 'source_tooltip', 'ingestion_type', 'predictive_status', 'title',
  'category', 'priority', 'timestamp', 'geo', 'location_label', 'details',
  'suggested_action', 'department',
];

const MAX_CANDIDATES = 20;

// One civic-news query → recent web results (Google Custom Search). `dateRestrict`
// biases toward the last month, mirroring the old Tavily `days: 30` news window.
function newsSearch(query) {
  return googleWebSearch(query, { num: 5, dateRestrict: 'm1' });
}

function relativeTime(dateStr) {
  if (!dateStr) return 'Just now';
  const t = Date.parse(dateStr);
  if (!Number.isFinite(t)) return 'Recently';
  const hours = Math.floor((Date.now() - t) / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function toRow(candidate) {
  const row = {};
  for (const key of ALERT_COLUMNS) row[key] = candidate[key];
  row.timestamp = relativeTime(candidate._publishedDate);
  return row;
}

/**
 * Crawl live civic news for the given cities, classify → dedup → persist.
 * Shared by POST (UI button, optional cityId) and GET (cron — all cities).
 */
async function runIngestion(cities) {
    // 1. Crawl + classify — all cities concurrently.
    const perCity = await Promise.all(
      cities.map(async (city) => {
        const resultSets = await Promise.all(buildQueries(city).map((q) => newsSearch(q)));
        const articles = resultSets.flat();
        const cands = [];
        for (const article of articles) {
          const candidate = classifyArticle(article, city);
          if (candidate) cands.push(candidate);
        }
        return { scanned: articles.length, cands };
      })
    );
    let scanned = 0;
    const candidates = [];
    for (const pc of perCity) {
      scanned += pc.scanned;
      candidates.push(...pc.cands);
    }

    // 2. Dedup against what's already stored + within this batch.
    const { data: existing } = await supabase.from('proactive_alerts').select('id, title');
    const existingIds = new Set((existing || []).map((a) => a.id));
    const existingTitles = (existing || []).map((a) => a.title);

    const acceptedTitles = [];
    const toInsert = [];
    for (const cand of candidates) {
      if (toInsert.length >= MAX_CANDIDATES) break;
      if (existingIds.has(cand.id)) continue;
      if (existingTitles.some((t) => titleSimilar(t, cand.title))) continue;
      if (acceptedTitles.some((t) => titleSimilar(t, cand.title))) continue;
      acceptedTitles.push(cand.title);
      toInsert.push(cand);
    }

    // 3. Persist.
    let inserted = [];
    if (toInsert.length > 0) {
      const rows = toInsert.map(toRow);
      const { data, error } = await supabase
        .from('proactive_alerts')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
        .select('id, title, category, priority, location_label');
      if (error) throw new Error(error.message);
      inserted = data || rows.map((r) => ({ id: r.id, title: r.title, category: r.category, priority: r.priority, location_label: r.location_label }));
    }

  return {
    ingested: inserted.length,
    skipped: candidates.length - inserted.length,
    scanned,
    cities: cities.map((c) => c.name),
    alerts: inserted,
  };
}

function preflight() {
  if (!isGoogleSearchConfigured()) {
    return NextResponse.json({ error: 'News ingestion is not configured (missing GOOGLE_SEARCH_API_KEY/GOOGLE_API_KEY or GOOGLE_SEARCH_CX).' }, { status: 501 });
  }
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Database not configured — cannot persist alerts.' }, { status: 501 });
  }
  return null;
}

/**
 * POST /proactive/ingest — crawl live civic news and persist new alerts.
 * Body: { cityId?: string }  (omit to scan every configured city)
 */
export async function POST(request) {
  const gate = preflight();
  if (gate) return gate;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const cityId = typeof body?.cityId === 'string' ? body.cityId : null;
  const cities = cityId ? CITIES.filter((c) => c.id === cityId) : CITIES;
  if (cities.length === 0) {
    return NextResponse.json({ error: `Unknown city: ${cityId}` }, { status: 400 });
  }

  try {
    return NextResponse.json(await runIngestion(cities), { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Ingestion failed: ' + (error?.message || String(error)) }, { status: 500 });
  }
}

/** GET /proactive/ingest — cron entry point; scans every configured city. */
export async function GET() {
  const gate = preflight();
  if (gate) return gate;
  try {
    return NextResponse.json(await runIngestion(CITIES), { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Ingestion failed: ' + (error?.message || String(error)) }, { status: 500 });
  }
}
