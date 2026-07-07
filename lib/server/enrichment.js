import { generateGeminiJson, isGeminiConfigured } from './gemini.js';

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
  if (isGeminiConfigured()) {
    try {
      const gemini = await geminiEnrich(rawSubmission);
      if (gemini) return gemini;
    } catch (err) {
      console.error('[enrichment] Gemini failed, falling back to mock:', err.message);
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
    validation_multiplier: data.validation_score !== undefined ? data.validation_score : 0.15,
    validation_context: data.validation_context || 'Standard validation based on text.',
  };
}

function capitalizeUrgency(u) {
  const v = String(u || '').toLowerCase();
  if (v.startsWith('crit')) return 'Critical';
  if (v.startsWith('high')) return 'High';
  if (v.startsWith('low')) return 'Low';
  return 'Medium';
}

async function performTavilySearch(query) {
  if (!process.env.TAVILY_API_KEY) return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        search_depth: "basic",
        include_answer: false,
        max_results: 3
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.results ? data.results.map(r => r.title + ": " + r.content).join("\\n") : null;
  } catch (e) {
    console.error("Tavily search failed:", e.message);
    return null;
  }
}

async function fetchImageAsBase64(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    return { mimeType, data: buffer.toString('base64') };
  } catch (e) {
    console.error("Image fetch failed:", e.message);
    return null;
  }
}

async function geminiEnrich(rawSubmission) {
  const system = `You are Civic CoPilot's AI ingestion layer for Indian constituency governance.
Return only valid JSON. Preserve meaning; do not invent facts.
Allowed categories: Mobility - Roads, Footpaths and Infrastructure; Water Supply and Services; Garbage and Unsanitary Practices; Pollution; Traffic and Road Safety; PWD; Streetlights; Sanitation; Electricity and Power Supply; Crime and Safety; Animal Husbandry; Yellow Spot.
Allowed urgency: Critical, High, Medium, Low.
Evaluate the claim's validity based on specificity (precise location vs vague), coherence, and potential photo/audio evidence provided in the text.
If an image is attached, actively use it to corroborate the claim (e.g. verify if the photo shows a pothole).
If web search results are provided, use them to see if local news corroborates the claim.
Output JSON:
{
  "normalized_text_en": "English translation or concise normalized summary",
  "category": "one allowed category",
  "need_type": "short operational need type",
  "urgency": "Critical|High|Medium|Low",
  "sentiment": "Neutral|Concerned|Anxious|Frustrated|Angry",
  "canonical_location": "ward, locality, landmark, or null",
  "extracted_entities": ["short lowercase entity strings"],
  "validation_score": 0.0 to 0.3 (float, e.g. 0.3 for highly specific/credible claims backed by photo/news, 0.1 for vague claims),
  "validation_context": "Short explanation of why this claim seems credible or suspicious (e.g. 'Highly credible: photo clearly shows pothole, and news confirms road issues in the area')."
}`;

  const ward = rawSubmission.geo?.ward || 'Bengaluru South';
  let finalLocation = ward;
  if (rawSubmission.geo && rawSubmission.geo.lat && rawSubmission.geo.lng && !rawSubmission.geo.ward) {
    const geoLoc = await reverseGeocode(rawSubmission.geo.lat, rawSubmission.geo.lng);
    if (geoLoc) finalLocation = geoLoc;
  }

  let searchResults = null;
  if (rawSubmission.raw_text) {
    const query = `${finalLocation} ${rawSubmission.raw_text.substring(0, 50)} news`;
    searchResults = await performTavilySearch(query);
  }

  const images = [];
  if (rawSubmission.photo_url) {
    const imgData = await fetchImageAsBase64(rawSubmission.photo_url);
    if (imgData) images.push(imgData);
  }

  const prompt = JSON.stringify(
    {
      raw_text: rawSubmission.raw_text || '',
      language: rawSubmission.language || 'auto',
      audio_url: rawSubmission.audio_url || null,
      photo_url_provided: Boolean(rawSubmission.photo_url),
      geo: rawSubmission.geo || null,
      web_search_results: searchResults || "None available.",
      task:
        'Translate/normalize, classify, infer responsible civic issue, extract location/entities, score urgency for MP action, and perform AI validation of the claim using the provided text, image (if any), and web search results.',
    },
    null,
    2
  );

  const data = await generateGeminiJson({ system, prompt, images, temperature: 0.05 });
  return data ? normalizeEnrichment(data, rawSubmission) : null;
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`, {
      headers: {
        'User-Agent': 'EchoMerge/1.0 (hackathon-demo)'
      }
    });
    const data = await res.json();
    if (data && data.address) {
      return data.address.neighbourhood || data.address.suburb || data.address.village || data.address.town || data.address.city || data.display_name.split(',')[0];
    }
  } catch (e) {
    console.error('Geocoding failed:', e);
  }
  return null;
}

// --- Deterministic mock (placeholder for Person 3's Gemini pipeline) --------
async function mockEnrich(rawSubmission) {
  const text = [rawSubmission.raw_text, rawSubmission.photo_url, rawSubmission.audio_url]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  let category = KNOWN_CATEGORIES.SANITATION;
  // If the complaint isn't recognized by the regex, use the first 5 words as the unique need_type
  // so the clustering engine doesn't falsely group all unknown complaints together.
  let need_type = rawSubmission.raw_text 
    ? rawSubmission.raw_text.split(' ').slice(0, 5).join(' ') 
    : 'General Maintenance';
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

  let location = 'Bengaluru South';
  if (rawSubmission.geo) {
    if (rawSubmission.geo.ward) {
      location = rawSubmission.geo.ward;
    } else if (rawSubmission.geo.lat && rawSubmission.geo.lng) {
      const geoLoc = await reverseGeocode(rawSubmission.geo.lat, rawSubmission.geo.lng);
      if (geoLoc) location = geoLoc;
    }
  }

  return {
    normalized_text_en,
    category,
    need_type,
    urgency,
    sentiment: 'Frustrated',
    canonical_location: location,
    extracted_entities: [need_type.toLowerCase(), category.toLowerCase()],
    validation_score: 0.2,
    validation_context: 'Mock AI Validation: Assessed text and regex patterns to confirm basic civic issue credibility.',
  };
}
