/**
 * News → proactive-alert extraction (deterministic, no external AI required).
 *
 * Web search returns real civic news with geographic noise, so every article is run
 * through a classifier that (a) must match a civic category, (b) must be about
 * the target city (city name or a known locality), and (c) is geocoded from a
 * built-in gazetteer — no Places key needed. A Gemini pass can be layered on top
 * later for higher accuracy; this heuristic is the reliable fallback that works
 * with the keys we actually have. Pure functions — easy to unit-test.
 */

import crypto from 'node:crypto';

// A small per-city gazetteer: known localities → coordinates. Lets us both
// confirm an article is about the city AND drop a pin near the right spot.
export const CITY_GAZETTEER = {
  bengaluru: [
    { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
    { name: 'Indiranagar', lat: 12.9719, lng: 77.6412 },
    { name: 'Whitefield', lat: 12.9698, lng: 77.75 },
    { name: 'Jayanagar', lat: 12.925, lng: 77.5938 },
    { name: 'HSR Layout', lat: 12.9121, lng: 77.6446 },
    { name: 'Marathahalli', lat: 12.9591, lng: 77.6974 },
    { name: 'Yelahanka', lat: 13.1007, lng: 77.5963 },
    { name: 'Electronic City', lat: 12.8399, lng: 77.677 },
    { name: 'BTM Layout', lat: 12.9166, lng: 77.6101 },
    { name: 'Hebbal', lat: 13.0358, lng: 77.597 },
    { name: 'Banashankari', lat: 12.925, lng: 77.5468 },
    { name: 'Malleshwaram', lat: 13.0035, lng: 77.5709 },
  ],
  mumbai: [
    { name: 'Andheri', lat: 19.1197, lng: 72.8468 },
    { name: 'Bandra', lat: 19.0596, lng: 72.8295 },
    { name: 'Dadar', lat: 19.0178, lng: 72.8478 },
    { name: 'Borivali', lat: 19.2307, lng: 72.8567 },
    { name: 'Kurla', lat: 19.0726, lng: 72.8845 },
    { name: 'Powai', lat: 19.1176, lng: 72.906 },
    { name: 'Colaba', lat: 18.9067, lng: 72.8147 },
    { name: 'Thane', lat: 19.2183, lng: 72.9781 },
    { name: 'Chembur', lat: 19.0522, lng: 72.9005 },
    { name: 'Goregaon', lat: 19.1663, lng: 72.849 },
  ],
  delhi: [
    { name: 'Saket', lat: 28.5245, lng: 77.2066 },
    { name: 'Dwarka', lat: 28.5921, lng: 77.046 },
    { name: 'Rohini', lat: 28.7433, lng: 77.0722 },
    { name: 'Karol Bagh', lat: 28.6512, lng: 77.1906 },
    { name: 'Connaught Place', lat: 28.6315, lng: 77.2167 },
    { name: 'Hauz Khas', lat: 28.5494, lng: 77.2001 },
    { name: 'Lajpat Nagar', lat: 28.5677, lng: 77.2433 },
    { name: 'Chandni Chowk', lat: 28.6506, lng: 77.2303 },
    { name: 'Nehru Place', lat: 28.5494, lng: 77.2513 },
    { name: 'Janakpuri', lat: 28.6217, lng: 77.0878 },
  ],
  chennai: [
    { name: 'T Nagar', lat: 13.0418, lng: 80.2341 },
    { name: 'Adyar', lat: 13.0012, lng: 80.2565 },
    { name: 'Velachery', lat: 12.9791, lng: 80.221 },
    { name: 'Anna Nagar', lat: 13.085, lng: 80.2101 },
    { name: 'Guindy', lat: 13.0067, lng: 80.2206 },
    { name: 'Mylapore', lat: 13.0368, lng: 80.2676 },
    { name: 'Tambaram', lat: 12.9249, lng: 80.1 },
    { name: 'Porur', lat: 13.0359, lng: 80.1567 },
  ],
  hyderabad: [
    { name: 'Gachibowli', lat: 17.44, lng: 78.3489 },
    { name: 'HITEC City', lat: 17.4435, lng: 78.3772 },
    { name: 'Banjara Hills', lat: 17.4156, lng: 78.4347 },
    { name: 'Secunderabad', lat: 17.4399, lng: 78.4983 },
    { name: 'Kukatpally', lat: 17.4849, lng: 78.4138 },
    { name: 'Ameerpet', lat: 17.4374, lng: 78.4487 },
    { name: 'LB Nagar', lat: 17.351, lng: 78.554 },
    { name: 'Madhapur', lat: 17.4483, lng: 78.3915 },
  ],
  pune: [
    { name: 'Hinjewadi', lat: 18.5913, lng: 73.7389 },
    { name: 'Kothrud', lat: 18.5074, lng: 73.8077 },
    { name: 'Hadapsar', lat: 18.5089, lng: 73.926 },
    { name: 'Baner', lat: 18.559, lng: 73.7868 },
    { name: 'Shivajinagar', lat: 18.5308, lng: 73.8478 },
    { name: 'Viman Nagar', lat: 18.5679, lng: 73.9143 },
    { name: 'Kharadi', lat: 18.5515, lng: 73.935 },
    { name: 'Wakad', lat: 18.5985, lng: 73.7627 },
  ],
};

// category profile key → alert fields. Keywords are matched against title+content.
const CATEGORY_PROFILES = {
  water: {
    keywords: ['water pipeline', 'pipeline', 'water pipe', 'water supply', 'sewage', 'sewer', 'stp', 'drinking water', 'borewell', 'tanker', 'water leak', 'water shortage', 'water main'],
    category: 'Water Supply and Services',
    department: 'State Water Supply & Sewerage Board',
    suggested_action: "Dispatch the water board's field crew to isolate the affected line and restore supply.",
  },
  drainage: {
    keywords: ['waterlogging', 'waterlogged', 'flooding', 'flooded', 'flood', 'stormwater', 'drain overflow', 'clogged drain', 'inundated', 'submerged'],
    category: 'Sanitation',
    department: 'Municipal Solid Waste & Drainage Department',
    suggested_action: 'Deploy dewatering pumps and clear the stormwater drains before the next spell.',
  },
  roads: {
    keywords: ['pothole', 'potholes', 'road cave', 'cave-in', 'caved in', 'road collapse', 'footpath', 'flyover', 'bridge crack', 'asphalt', 'bad road', 'crater', 'road damage'],
    category: 'Mobility - Roads, Footpaths and Infrastructure',
    department: 'Public Works Department (PWD)',
    suggested_action: 'Assign a PWD rapid road-repair unit to barricade the hazard and patch the defect.',
  },
  power: {
    keywords: ['power outage', 'power cut', 'powercut', 'transformer', 'electricity', 'feeder', 'streetlight', 'street light', 'voltage', 'discom', 'electrocution', 'power supply', 'blackout'],
    category: 'Electricity and Power Supply',
    department: 'State Electricity Distribution Company (DISCOM)',
    suggested_action: 'Schedule a DISCOM inspection and restore the affected feeder / streetlights.',
  },
  waste: {
    keywords: ['garbage', 'waste', 'trash', 'litter', 'dump', 'black spot', 'blackspot', 'sanitation', 'dengue', 'mosquito', 'fogging', 'landfill', 'unsanitary'],
    category: 'Sanitation',
    department: 'Municipal Solid Waste Management Department',
    suggested_action: 'Deploy a solid-waste clearance crew and sanitise the black-spot.',
  },
  air: {
    keywords: ['air quality', 'aqi', 'pollution', 'smog', 'pm2.5', 'pm 2.5', 'toxic air', 'emission'],
    category: 'Sanitation',
    department: 'Municipal Health & Sanitation Department',
    suggested_action: 'Dispatch the environmental enforcement squad to the emission source.',
  },
  safety: {
    keywords: ['building collapse', 'wall collapse', 'fire', 'gas leak', 'accident', 'encroachment', 'manhole', 'open drain', 'hazard'],
    category: 'Crime and Safety',
    department: 'Public Safety & Police Liaison',
    suggested_action: 'Coordinate a joint site visit with the police liaison and deploy immediate mitigation.',
  },
};

const CRITICAL_WORDS = ['burst', 'explosion', 'explode', 'collapse', 'collapsed', 'dead', 'death', 'killed', 'fatal', 'emergency', 'crisis', 'severe', 'rupture', 'submerged', 'drowned', 'hazardous', 'cave-in', 'caved', 'major', 'toxic'];
const WARNING_WORDS = ['shortage', 'disrupt', 'disruption', 'damage', 'damaged', 'worsen', 'spike', 'overflow', 'blocked', 'blockage', 'protest', 'complaint', 'warning', 'outage', 'leak', 'leaking', 'waterlogging', 'flooded', 'flood', 'stalled', 'delay'];

const KNOWN_OUTLETS = {
  deccanherald: 'Deccan Herald', thehindu: 'The Hindu', timesofindia: 'Times of India',
  indianexpress: 'The Indian Express', newindianexpress: 'The New Indian Express',
  hindustantimes: 'Hindustan Times', ndtv: 'NDTV', news18: 'News18',
  thenewsminute: 'The News Minute', livemint: 'Mint', moneycontrol: 'Moneycontrol',
  indiatoday: 'India Today', firstpost: 'Firstpost', scroll: 'Scroll.in',
  thequint: 'The Quint', bangaloremirror: 'Bangalore Mirror', mumbaimirror: 'Mumbai Mirror',
  freepressjournal: 'Free Press Journal', midday: 'Mid-Day', dtnext: 'DT Next',
};

function hashHex(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex');
}

export function alertIdFor(article) {
  return `NEWS_${hashHex(article.url || article.title || '').slice(0, 10)}`;
}

export function outletFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const key = host.split('.')[0];
    return KNOWN_OUTLETS[key] || host;
  } catch {
    return 'Local News';
  }
}

function jitter(city, seed) {
  const h = hashHex(seed);
  const dx = (parseInt(h.slice(0, 4), 16) / 0xffff - 0.5) * 0.06;
  const dy = (parseInt(h.slice(4, 8), 16) / 0xffff - 0.5) * 0.06;
  return { lat: +(city.lat + dy).toFixed(4), lng: +(city.lng + dx).toFixed(4) };
}

function matchCategory(text) {
  for (const [key, profile] of Object.entries(CATEGORY_PROFILES)) {
    if (profile.keywords.some((kw) => text.includes(kw))) return key;
  }
  return null;
}

function matchSeverity(text) {
  if (CRITICAL_WORDS.some((w) => text.includes(w))) return 'Critical';
  if (WARNING_WORDS.some((w) => text.includes(w))) return 'Warning';
  return 'Monitor';
}

/** Search-query templates for a city (kept few to bound search-API calls). */
export function buildQueries(city) {
  const c = city.name;
  return [
    `${c} water pipeline burst OR sewage overflow OR drinking water shortage`,
    `${c} pothole OR road cave-in OR flyover OR waterlogging`,
    `${c} power outage OR transformer fire OR garbage OR building collapse`,
  ];
}

/**
 * Classify one search-result article into a proactive-alert candidate for `city`.
 * Returns null when the article isn't a civic issue or isn't about the city.
 * @param {{title?:string, content?:string, url?:string, published_date?:string}} article
 * @param {{id:string, name:string, lat:number, lng:number}} city
 */
export function classifyArticle(article, city) {
  const title = String(article.title || '').trim();
  const content = String(article.content || '').trim();
  const text = `${title} ${content}`.toLowerCase();
  if (!title) return null;

  const catKey = matchCategory(text);
  if (!catKey) return null; // not a civic-infrastructure story

  const localities = CITY_GAZETTEER[city.id] || [];
  const locality = localities.find((l) => text.includes(l.name.toLowerCase()));
  const cityMentioned = text.includes(city.name.toLowerCase());
  if (!locality && !cityMentioned) return null; // geographic noise — skip

  const profile = CATEGORY_PROFILES[catKey];
  const priority = matchSeverity(text);
  const geo = locality ? { lat: locality.lat, lng: locality.lng } : jitter(city, title);
  const location_label = locality ? `${city.name} — ${locality.name}` : city.name;
  const outlet = outletFromUrl(article.url);

  return {
    id: alertIdFor(article),
    source: `${outlet} (Local News Crawl)`,
    source_tooltip: `Source: ${outlet} · News NLP`,
    ingestion_type: 'News Feeds (NLP)',
    predictive_status: 'System-Detected',
    title,
    category: profile.category,
    priority,
    geo,
    location_label,
    details: content ? content.slice(0, 600) : title,
    suggested_action: profile.suggested_action,
    department: profile.department,
    _url: article.url,
    _publishedDate: article.published_date || null,
  };
}

function titleTokens(title) {
  return new Set(
    String(title)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

/** Jaccard token overlap ≥ 0.5 → treat as the same story. */
export function titleSimilar(a, b) {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (!ta.size || !tb.size) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter) >= 0.5;
}
