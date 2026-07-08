const DEFAULT_MODEL = 'gemini-2.5-flash';
const TIMEOUT_MS = 18000;

// Circuit breaker: when the API returns a hard auth/permission error (401/403),
// the credentials aren't going to start working within a request or two. Rather
// than pay the full round-trip (plus the upstream Tavily/geocode work that feeds
// the prompt) on every submission only to fall back to the deterministic path, we
// stop attempting Gemini for a cooldown window. This keeps the awaited /submit
// pipeline fast where Gemini is blocked, while auto-recovering (and never tripping)
// where it works.
const BREAKER_COOLDOWN_MS = 5 * 60 * 1000;
let geminiBlockedUntil = 0;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

/** Configured AND not currently circuit-broken. Callers on the hot path (enrich,
 *  embed) should gate on this so a known-blocked key is skipped immediately. */
export function isGeminiAvailable() {
  return isGeminiConfigured() && Date.now() >= geminiBlockedUntil;
}

/** Trip the breaker on persistent auth failures; transient errors are ignored. */
function noteGeminiFailure(status) {
  if (status === 401 || status === 403) {
    geminiBlockedUntil = Date.now() + BREAKER_COOLDOWN_MS;
  }
}

export async function generateGeminiText({ system, prompt, temperature = 0.2 }) {
  if (!isGeminiAvailable()) return null;

  const data = await callGenerateContent({
    system,
    prompt,
    generationConfig: {
      temperature,
    },
  });

  return extractText(data);
}

export async function generateGeminiJson({ system, prompt, images = [], temperature = 0.1 }) {
  if (!isGeminiAvailable()) return null;

  const data = await callGenerateContent({
    system,
    prompt,
    images,
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
    },
  });

  const text = extractText(data);
  if (!text) return null;
  return parseJsonObject(text);
}

export async function generateGeminiEmbedding(text, { outputDimensionality = 768 } = {}) {
  if (!isGeminiAvailable()) return null;

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const model = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
  const endpoint =
    process.env.GEMINI_EMBEDDING_API_BASE_URL ||
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:embedContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: `models/${model}`,
        content: {
          parts: [{ text: String(text || '') }],
        },
        embedContentConfig: {
          taskType: 'CLUSTERING',
          outputDimensionality,
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      noteGeminiFailure(res.status);
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini embedding API ${res.status}: ${body.slice(0, 240)}`);
    }
    const data = await res.json();
    const values = data?.embedding?.values;
    return Array.isArray(values) ? values.map(Number) : null;
  } finally {
    clearTimeout(timer);
  }
}

async function callGenerateContent({ system, prompt, images = [], generationConfig }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint =
    process.env.GEMINI_API_BASE_URL ||
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: system
          ? {
              parts: [{ text: system }],
            }
          : undefined,
        contents: [
          {
            role: 'user',
            parts: [
              ...images.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
              { text: prompt }
            ],
          },
        ],
        generationConfig,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      noteGeminiFailure(res.status);
      const body = await res.text().catch(() => '');
      throw new Error(`Gemini API ${res.status}: ${body.slice(0, 240)}`);
    }

    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((part) => part.text || '').join('\n').trim();
}

function parseJsonObject(text) {
  const clean = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(clean);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.error('[gemini] JSON parse failed:', error.message);
    return null;
  }
}
