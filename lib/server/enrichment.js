/**
 * Enrichment seam (Person 3 owns the model; Person 2 owns the wiring).
 *
 * If ENRICHMENT_SERVICE_URL is set, POST /submit calls that HTTP service for
 * real Gemini enrichment. Otherwise a deterministic keyword mock keeps the
 * whole pipeline runnable for anyone who clones the repo. Either way the return
 * value conforms to the EnrichedSubmission fields in /docs/contracts.md.
 */

const KNOWN_CATEGORIES = {
  MOBILITY: 'Mobility - Roads, Footpaths and Infrastructure',
  WATER: 'Water Supply and Services',
  GARBAGE: 'Garbage and Unsanitary Practices',
  STREETLIGHTS: 'Streetlights',
  SANITATION: 'Sanitation',
};

const TIMEOUT_MS = 20000;

export async function enrich(rawSubmission) {
  const serviceUrl = process.env.ENRICHMENT_SERVICE_URL;
  if (serviceUrl) {
    try {
      return await callEnrichmentService(serviceUrl, rawSubmission);
    } catch (err) {
      console.error('[enrichment] service failed, falling back to mock:', err.message);
    }
  }
  return mockEnrich(rawSubmission);
}

async function callEnrichmentService(serviceUrl, rawSubmission) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(serviceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raw_text: rawSubmission.raw_text,
        language: rawSubmission.language,
        audio_url: rawSubmission.audio_url,
        photo_url: rawSubmission.photo_url,
        geo: rawSubmission.geo,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`enrichment service ${res.status}`);
    const data = await res.json();
    return normalizeEnrichment(data, rawSubmission);
  } finally {
    clearTimeout(timer);
  }
}

/** Guarantee contract-shaped output no matter what the service returns. */
function normalizeEnrichment(data, rawSubmission) {
  return {
    normalized_text_en: data.normalized_text_en || rawSubmission.raw_text || '',
    category: data.category || KNOWN_CATEGORIES.SANITATION,
    need_type: data.need_type || 'General',
    urgency: capitalizeUrgency(data.urgency),
    sentiment: data.sentiment || 'Neutral',
    canonical_location: data.canonical_location ?? null,
    extracted_entities: Array.isArray(data.extracted_entities)
      ? data.extracted_entities
      : [],
  };
}

function capitalizeUrgency(u) {
  const v = String(u || '').toLowerCase();
  if (v.startsWith('crit')) return 'Critical';
  if (v.startsWith('high')) return 'High';
  if (v.startsWith('low')) return 'Low';
  return 'Medium';
}

// --- Deterministic mock (placeholder for Person 3's Gemini pipeline) --------
function mockEnrich(rawSubmission) {
  const text = (rawSubmission.raw_text || '').toLowerCase();
  let category = KNOWN_CATEGORIES.SANITATION;
  let need_type = 'General Maintenance';
  let urgency = 'Medium';
  let normalized_text_en = rawSubmission.raw_text || 'Citizen submission';

  if (/road|pothole|footpath|सड़क|ರಸ್ತೆ|சாலை/.test(text)) {
    category = KNOWN_CATEGORIES.MOBILITY;
    need_type = 'Pothole / Road Repair';
    urgency = 'High';
    normalized_text_en = 'The road/footpath is damaged and unsafe for use.';
  } else if (/water|drain|leak|sewage|पानी|ನೀರು|தண்ணீர்/.test(text)) {
    category = KNOWN_CATEGORIES.WATER;
    need_type = 'Drainage / Water Supply';
    urgency = 'High';
    normalized_text_en = 'Water supply or drainage issue causing overflow / shortage.';
  } else if (/light|street|dark|बिजली|ಬೀದಿ|விளக்கு/.test(text)) {
    category = KNOWN_CATEGORIES.STREETLIGHTS;
    need_type = 'Streetlight Repair';
    urgency = 'Medium';
    normalized_text_en = 'Streetlights are broken, causing safety concerns at night.';
  } else if (/waste|garbage|trash|कचरा|ಕಸ|குப்பை/.test(text)) {
    category = KNOWN_CATEGORIES.GARBAGE;
    need_type = 'Garbage Clearance';
    urgency = 'Medium';
    normalized_text_en = 'Garbage has accumulated and needs clearance.';
  }

  const location =
    rawSubmission.geo && rawSubmission.geo.ward ? rawSubmission.geo.ward : 'Bengaluru South';

  return {
    normalized_text_en,
    category,
    need_type,
    urgency,
    sentiment: 'Frustrated',
    canonical_location: location,
    extracted_entities: [need_type.toLowerCase(), category.toLowerCase()],
  };
}
