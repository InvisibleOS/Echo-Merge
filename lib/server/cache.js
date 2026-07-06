/**
 * Tiny in-process TTL cache (Person 2 — Day 4 "cache hot queries").
 *
 * The dashboard hammers GET /priorities and GET /hotspots on every poll; those
 * are read-heavy aggregate queries that only change when a new submission is
 * processed. A short-TTL memo in front of them keeps the endpoints snappy at
 * volume without adding Redis. On Cloud Run this is per-instance, which is
 * exactly what we want for a demo: correct, and invalidated the moment a
 * /submit mutates the aggregates.
 */

const store = new Map(); // key -> { value, expires }

/**
 * Return a cached value for `key`, or compute it via `producer()`, store it for
 * `ttlMs`, and return it. Concurrent callers within the TTL share one result.
 */
export async function cached(key, ttlMs, producer) {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) {
    return hit.value;
  }
  const value = await producer();
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

/** Drop one key, or (no arg) the whole cache. Called after a successful submit. */
export function invalidate(key) {
  if (key === undefined) {
    store.clear();
    return;
  }
  store.delete(key);
}

export const CACHE_KEYS = {
  priorities: 'priorities',
  hotspots: 'hotspots',
};
