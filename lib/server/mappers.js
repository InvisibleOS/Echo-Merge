/**
 * DB row -> frozen contract shape (Person 2 — keeps the API honest to
 * /docs/contracts.md regardless of how rows are stored). Pure functions, easy
 * to unit-test, no Supabase import here.
 */

import { rateComplaint } from './ai-rating.js';

const URGENCY_INTENSITY = {
  Critical: 1.0,
  High: 0.75,
  Medium: 0.5,
  Low: 0.25,
};

const BENGALURU_SOUTH = { lat: 12.9071, lng: 77.5952 }; // constituency centroid fallback

function coord(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Normalise a stored hotspot_geo/geo jsonb into a clean {lat,lng,(ward)}. */
export function toGeoPoint(geo, fallback = BENGALURU_SOUTH) {
  if (!geo || typeof geo !== 'object') return { ...fallback };
  const out = {
    lat: coord(geo.lat, fallback.lat),
    lng: coord(geo.lng, fallback.lng),
  };
  if (typeof geo.ward === 'string' && geo.ward.trim()) out.ward = geo.ward.trim();
  return out;
}

/** One evidence entry -> SupportingEvidence (contract §1). */
function toEvidence(e) {
  if (!e || typeof e !== 'object') return null;
  const out = {
    submission_id: e.submission_id ?? e.id ?? null,
    // Older aggregation stored only `text`; map it into normalized_text_en.
    raw_text: e.raw_text ?? '',
    normalized_text_en: e.normalized_text_en ?? e.text ?? '',
    language: e.language ?? 'unknown',
  };
  // Optional drill-down pin data, carried through when present.
  if (e.geo && (e.geo.lat != null || e.geo.ward)) out.geo = toGeoPoint(e.geo);
  if (e.canonical_location && e.canonical_location !== 'nan') {
    out.canonical_location = e.canonical_location;
  }
  return out;
}

/** priorities row -> PriorityItem (contract §1). */
export function toPriorityItem(row) {
  const demand_score = Number(row.demand_score) || 0;
  const demand_count = Number(row.demand_count) || 0;
  const ai_rating = rateComplaint({
    ai_rating: row.ai_rating,
    category: row.category,
    urgency: row.urgency,
    demand_score,
    demand_count,
  });
  return {
    work_id: row.work_id,
    title: row.title,
    category: row.category,
    demand_score,
    demand_count,
    ai_rating,
    hotspot_geo: toGeoPoint(row.hotspot_geo),
    supporting_evidence: Array.isArray(row.supporting_evidence)
      ? row.supporting_evidence.map(toEvidence).filter(Boolean)
      : [],
    rank: row.rank == null ? null : Number(row.rank),
    explanation: row.explanation ?? '',
    constituency: row.hotspot_geo?.constituency ?? undefined, // Extract constituency if we embed it in hotspot_geo
    scoring_breakdown: row.hotspot_geo?.scoring_breakdown ?? undefined,
    solution_plan: row.solution_plan ?? undefined,
    status: row.solution_plan?.resolved ? 'Resolved' : 'In Progress',
  };
}

/**
 * submissions row (with joined enriched_submissions) -> flat EnrichedSubmission.
 * Supabase returns the join as a nested object or 1-element array depending on
 * cardinality — handle both. `canonical_location` of "nan" is treated as absent.
 */
export function toEnrichedSubmission(row) {
  const e = Array.isArray(row.enriched_submissions)
    ? row.enriched_submissions[0]
    : row.enriched_submissions;

  const canonical =
    e && e.canonical_location && e.canonical_location !== 'nan'
      ? e.canonical_location
      : undefined;

  return {
    id: row.id,
    timestamp: row.timestamp,
    channel: row.channel,
    raw_text: row.raw_text ?? undefined,
    audio_url: row.audio_url ?? undefined,
    photo_url: row.photo_url ?? undefined,
    language: row.language,
    geo: row.geo ?? undefined,
    citizen_id_hash: row.citizen_id_hash,
    // enrichment (may be absent if the pipeline hasn't run yet)
    normalized_text_en: e?.normalized_text_en ?? '',
    category: e?.category ?? '',
    need_type: e?.need_type ?? '',
    urgency: e?.urgency ?? 'Medium',
    sentiment: e?.sentiment ?? undefined,
    canonical_location: canonical,
    extracted_entities: normalizeEntities(e?.extracted_entities),
  };
}

function normalizeEntities(ents) {
  if (Array.isArray(ents)) return ents;
  if (ents && typeof ents === 'object') {
    // Old mock stored {keywords:[...]}; flatten to a string[].
    if (Array.isArray(ents.keywords)) return ents.keywords;
    return Object.values(ents).flat().filter((x) => typeof x === 'string');
  }
  return [];
}

export function hotspotFromSubmission({ geo, category, urgency, constituency }) {
  return {
    geo: toGeoPoint(geo),
    intensity: URGENCY_INTENSITY[urgency] ?? 0.5,
    category: category ?? 'Uncategorised',
    demand_count: 1,
    constituency,
  };
}

/** priorities row -> Hotspot, used when there are no per-submission points. */
export function hotspotFromPriority(row) {
  const score = Number(row.demand_score) || 0;
  return {
    geo: toGeoPoint(row.hotspot_geo),
    intensity: Math.max(0, Math.min(1, score / 100)),
    category: row.category ?? 'Uncategorised',
    demand_count: Number(row.demand_count) || 0,
    constituency: row.hotspot_geo?.constituency ?? undefined,
  };
}
