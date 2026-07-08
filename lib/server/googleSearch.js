/**
 * Google Programmable Search (Custom Search JSON API) — the Google-native
 * replacement for Tavily. Both callers (submit-time enrichment fact-checking and
 * the proactive news crawl) need *raw web results* to feed into a model /
 * classifier, so this returns the same normalized shape the Tavily path produced
 * and downstream code is unchanged.
 *
 * Env:
 *   GOOGLE_SEARCH_API_KEY  API key with the "Custom Search API" enabled.
 *                          Falls back to GOOGLE_API_KEY (same key works if that
 *                          API is enabled on the project).
 *   GOOGLE_SEARCH_CX       Programmable Search Engine id. Create one at
 *                          programmablesearchengine.google.com with
 *                          "Search the entire web" turned on, then copy its
 *                          "Search engine ID".
 */

const ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

function searchApiKey() {
  return process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_API_KEY || null;
}

export function isGoogleSearchConfigured() {
  return Boolean(searchApiKey() && process.env.GOOGLE_SEARCH_CX);
}

/**
 * Run one web search. Returns an array of normalized results shaped like the old
 * Tavily results: `{ title, content, url, published_date }`. Returns `[]` on any
 * error, when unconfigured, or when there are no results — callers already treat
 * an empty result set as "no web context", so failures degrade gracefully.
 *
 * @param {string} query
 * @param {{num?:number, dateRestrict?:string, timeoutMs?:number}} [opts]
 *   num          1–10 results (Custom Search hard-caps at 10).
 *   dateRestrict e.g. 'd30' (last 30 days), 'm1' (last month) — omit for all time.
 *   timeoutMs    abort budget for the awaited request (default 5000).
 */
export async function googleWebSearch(query, opts = {}) {
  const { num = 5, dateRestrict, timeoutMs = 5000 } = opts;
  const apiKey = searchApiKey();
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!apiKey || !cx || !query) return [];

  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: query,
    num: String(Math.min(Math.max(num, 1), 10)),
  });
  if (dateRestrict) params.set('dateRestrict', dateRestrict);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.items)) return [];
    return data.items.map(normalizeItem);
  } catch (e) {
    console.error('Google Custom Search failed:', e.message || e);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function normalizeItem(item) {
  return {
    title: item.title || '',
    content: item.snippet || '',
    url: item.link || '',
    published_date: extractDate(item),
  };
}

// Custom Search has no first-class publish date; dig it out of the page metadata
// when the source exposes it (best-effort — otherwise null, same as Tavily
// results that lacked a date).
function extractDate(item) {
  const pm = item.pagemap || {};
  const meta = (pm.metatags && pm.metatags[0]) || {};
  const news = (pm.newsarticle && pm.newsarticle[0]) || {};
  return (
    meta['article:published_time'] ||
    news.datepublished ||
    meta['og:updated_time'] ||
    null
  );
}
