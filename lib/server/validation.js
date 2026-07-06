import { createHash } from 'crypto';

/**
 * Input hardening for the ingestion path (Person 2 — Day 5 "handle bad geo +
 * missing fields", and the content hash that powers idempotent /submit).
 */

/**
 * Validate/normalise a geo value. Accepts either {lat,lng} or {ward}. Returns
 * `{ geo, warning }` where `geo` is a cleaned value or null (never throws — a
 * bad location must not drop a citizen's submission on the floor).
 */
export function normalizeGeo(geo) {
  if (geo == null) return { geo: null, warning: null };

  // Ward-only geo is valid and needs no coordinate check.
  if (typeof geo === 'object' && typeof geo.ward === 'string' && geo.ward.trim()) {
    const out = { ward: geo.ward.trim() };
    if (isFiniteCoord(geo.lat, 90) && isFiniteCoord(geo.lng, 180)) {
      out.lat = Number(geo.lat);
      out.lng = Number(geo.lng);
    }
    return { geo: out, warning: null };
  }

  if (typeof geo === 'object' && geo.lat != null && geo.lng != null) {
    if (isFiniteCoord(geo.lat, 90) && isFiniteCoord(geo.lng, 180)) {
      return { geo: { lat: Number(geo.lat), lng: Number(geo.lng) }, warning: null };
    }
    // Out-of-range / non-numeric coords: keep the submission, drop the geo.
    return {
      geo: null,
      warning: `Ignored invalid geo (lat=${geo.lat}, lng=${geo.lng}); out of range.`,
    };
  }

  return { geo: null, warning: 'Unrecognised geo shape; ignored.' };
}

function isFiniteCoord(v, max) {
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= max;
}

/**
 * Validate a raw /submit payload. Returns `{ ok, errors, value }`.
 * A submission needs a language and at least one of text/audio/photo — an
 * empty submission is meaningless and rejected with 400.
 */
export function validateSubmitPayload(body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    return { ok: false, errors: ['Request body must be a JSON object.'], value: null };
  }

  const raw_text = trimOrNull(body.raw_text);
  const audio_url = trimOrNull(body.audio_url);
  const photo_url = trimOrNull(body.photo_url);
  // The citizen form sends media as raw base64 (audio_base64 / photo_base64);
  // it's persisted to a URL later in the route. Accept either form.
  const audio_base64 = trimOrNull(body.audio_base64);
  const photo_base64 = trimOrNull(body.photo_base64);

  if (!raw_text && !audio_url && !photo_url && !audio_base64 && !photo_base64) {
    errors.push('Provide at least one of raw_text, audio, or photo.');
  }

  const language = trimOrNull(body.language);
  if (!language) errors.push('Missing required field: language.');

  const channel = trimOrNull(body.channel) || 'web';

  const { geo, warning: geoWarning } = normalizeGeo(body.geo);

  // citizen_id_hash is optional from the form; derive an anonymous fallback so
  // the NOT NULL column and idempotency still work without leaking identity.
  const citizen_id_hash =
    trimOrNull(body.citizen_id_hash) ||
    anonId({ raw_text, audio_url, photo_url, audio_base64, photo_base64 });

  const value = {
    channel,
    raw_text,
    audio_url,
    photo_url,
    audio_base64,
    photo_base64,
    language,
    geo,
    citizen_id_hash,
  };

  return { ok: errors.length === 0, errors, value, geoWarning };
}

/**
 * Stable content fingerprint for idempotency. Same citizen + same content =
 * same hash, so a double-tap or a network retry collapses to one row.
 */
export function contentHash(value) {
  // Hash the media *content* (base64), not the eventual upload URL, so the same
  // photo/voice re-submitted dedupes deterministically regardless of storage
  // producing a fresh filename each time.
  const basis = [
    value.citizen_id_hash || '',
    (value.raw_text || '').trim(),
    value.audio_url || '',
    value.photo_url || '',
    value.audio_base64 || '',
    value.photo_base64 || '',
    value.language || '',
  ].join('|');
  return createHash('sha256').update(basis).digest('hex');
}

function trimOrNull(v) {
  if (typeof v !== 'string') return v == null ? null : v;
  const t = v.trim();
  return t.length ? t : null;
}

function anonId(parts) {
  return (
    'anon_' +
    createHash('sha256')
      .update(JSON.stringify(parts))
      .digest('hex')
      .slice(0, 12)
  );
}
