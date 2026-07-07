import { NextResponse } from 'next/server';
import { generateGeminiText, isGeminiConfigured } from '../../../lib/server/gemini.js';

export const dynamic = 'force-dynamic';

/**
 * POST /translate  — server-side translation for the citizen dashboard.
 *
 * Body: { q: string[], target: string, source?: string }
 * Returns: { translations: string[], engine }  (translations in `q` order)
 *
 * Engine cascade (first that works wins, per batch):
 *   1. Google Cloud Translation API v2  — the official keyed API (preferred).
 *   2. Gemini (generativelanguage)      — reuses the app's existing key/helper.
 *   3. Google Translate web endpoint    — keyless, no project setup required.
 * Once an engine reports "not enabled / blocked" we stop trying it for the rest
 * of the process. Keys never leave the server; a total failure returns 502 and
 * the client quietly reverts to the original English text.
 */

const V2_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
const GTX_ENDPOINT = 'https://translate.googleapis.com/translate_a/single';
const MAX_ITEMS_PER_CALL = 64;
const MAX_CHARS_PER_CALL = 4500;
const GTX_CONCURRENCY = 8;

// Learned once per server process so we skip dead engines on later requests.
let v2Disabled = false;
let geminiDisabled = false;

const LANG_NAMES = {
  en: 'English', hi: 'Hindi', kn: 'Kannada', ta: 'Tamil', te: 'Telugu',
  ml: 'Malayalam', mr: 'Marathi', bn: 'Bengali', gu: 'Gujarati', pa: 'Punjabi', ur: 'Urdu',
};

const BLOCKED_RE = /has not been used|is disabled|are blocked|SERVICE_DISABLED|API_KEY_SERVICE_BLOCKED|PERMISSION_DENIED|\b403\b/i;

function chunk(items) {
  const batches = [];
  let current = [];
  let chars = 0;
  for (const item of items) {
    const len = (item || '').length;
    if (current.length > 0 && (current.length >= MAX_ITEMS_PER_CALL || chars + len > MAX_CHARS_PER_CALL)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(item);
    chars += len;
  }
  if (current.length) batches.push(current);
  return batches;
}

/** 1. Google Cloud Translation API v2. */
async function translateV2(batch, target, source, key) {
  const payload = { q: batch, target, format: 'text' };
  if (source) payload.source = source;
  const res = await fetch(`${V2_ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message || `Translation upstream error ${res.status}`;
    const err = new Error(msg);
    err.blocked = res.status === 403 || BLOCKED_RE.test(msg);
    throw err;
  }
  const translations = json?.data?.translations || [];
  return batch.map((src, i) => translations[i]?.translatedText ?? src);
}

/** 2. Gemini via the app's shared helper (returns a JSON array of strings). */
async function translateGemini(batch, target) {
  const langName = LANG_NAMES[target] || target;
  const system =
    'You are a precise UI localization engine for a civic-governance web app. ' +
    'Translate naturally for a native speaker and output ONLY valid JSON.';
  const prompt =
    `Translate each string in this JSON array into ${langName}. ` +
    `Return ONLY a JSON array of strings with the exact same length and order — ` +
    `each element is the translation of the corresponding input element. ` +
    `Do not merge, split, drop, reorder, or explain. Keep numbers, IDs, "₹" amounts and punctuation intact.\n\n` +
    JSON.stringify(batch);

  const text = await generateGeminiText({ system, prompt, temperature: 0 });
  if (!text) throw new Error('Gemini returned no translation.');
  const clean = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  let arr = null;
  try {
    arr = JSON.parse(clean);
  } catch {
    arr = null;
  }
  if (!Array.isArray(arr)) throw new Error('Gemini returned an unparseable translation.');
  return batch.map((src, i) => (typeof arr[i] === 'string' ? arr[i] : src));
}

/** 3. Keyless Google Translate web endpoint — one string per call, pooled. */
async function gtxOne(text, target, source) {
  const sl = source || 'auto';
  const url =
    `${GTX_ENDPOINT}?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(target)}` +
    `&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Google Translate web error ${res.status}`);
  const data = await res.json();
  const segments = Array.isArray(data?.[0]) ? data[0] : [];
  const joined = segments.map((s) => (Array.isArray(s) ? s[0] || '' : '')).join('');
  return joined || text;
}

async function translateGtx(batch, target, source) {
  const out = new Array(batch.length);
  let idx = 0;
  async function worker() {
    while (idx < batch.length) {
      const i = idx++;
      try {
        out[i] = await gtxOne(batch[i], target, source);
      } catch {
        out[i] = batch[i];
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(GTX_CONCURRENCY, batch.length) }, worker));
  return out;
}

async function translateOneBatch(batch, target, source, key) {
  if (!v2Disabled && key) {
    try {
      return { engine: 'cloud-translation-v2', out: await translateV2(batch, target, source, key) };
    } catch (e) {
      if (e.blocked) v2Disabled = true;
    }
  }
  if (!geminiDisabled && isGeminiConfigured()) {
    try {
      return { engine: 'gemini', out: await translateGemini(batch, target) };
    } catch (e) {
      if (BLOCKED_RE.test(e?.message || '')) geminiDisabled = true;
    }
  }
  return { engine: 'google-web', out: await translateGtx(batch, target, source) };
}

export async function POST(request) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const q = Array.isArray(body?.q) ? body.q.filter((s) => typeof s === 'string') : [];
  const target = typeof body?.target === 'string' ? body.target.trim() : '';
  const source = typeof body?.source === 'string' ? body.source.trim() : undefined;

  if (!target) return NextResponse.json({ error: 'Missing `target` language.' }, { status: 400 });
  if (q.length === 0) return NextResponse.json({ translations: [] }, { status: 200 });

  try {
    let engine = '';
    const out = [];
    for (const batch of chunk(q)) {
      const result = await translateOneBatch(batch, target, source, key);
      engine = result.engine;
      out.push(...result.out);
    }
    return NextResponse.json({ translations: out, engine }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Translation request failed: ' + (err?.message || String(err)) },
      { status: 502 }
    );
  }
}
