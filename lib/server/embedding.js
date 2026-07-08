import { createHash } from 'crypto';
import { generateGeminiEmbedding, isGeminiAvailable } from './gemini.js';

/**
 * Embedding seam (Person 4 owns the model; Person 2 owns the wiring).
 *
 * If EMBEDDING_SERVICE_URL is set, we call it for real Vertex AI
 * text-embeddings (768-dim). Otherwise a deterministic hash-based mock produces
 * a stable 768-dim unit-ish vector so pgvector storage + top-k search still
 * work offline. Embeddings are always generated on the ENGLISH normalized text
 * so cross-language duplicates cluster (contract §1 / roadmap pgvector tip).
 */

export const EMBEDDING_DIM = 768;
const TIMEOUT_MS = 20000;

export async function embed(text) {
  const serviceUrl = process.env.EMBEDDING_SERVICE_URL;
  if (serviceUrl) {
    try {
      const vec = await callEmbeddingService(serviceUrl, text);
      if (Array.isArray(vec) && vec.length === EMBEDDING_DIM) return vec;
      console.error(
        `[embedding] service returned ${vec?.length} dims (expected ${EMBEDDING_DIM}); using mock.`
      );
    } catch (err) {
      console.error('[embedding] service failed, falling back to mock:', err.message);
    }
  }
  if (isGeminiAvailable()) {
    try {
      const vec = await generateGeminiEmbedding(text, { outputDimensionality: EMBEDDING_DIM });
      if (Array.isArray(vec) && vec.length === EMBEDDING_DIM) return vec;
      console.error(
        `[embedding] Gemini returned ${vec?.length} dims (expected ${EMBEDDING_DIM}); using mock.`
      );
    } catch (err) {
      console.error('[embedding] Gemini failed, falling back to mock:', err.message);
    }
  }
  return mockEmbed(text);
}

async function callEmbeddingService(serviceUrl, text) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(serviceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`embedding service ${res.status}`);
    const data = await res.json();
    return data.vector || data.embedding || data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Deterministic mock embedding: same text -> same vector (so idempotent
 * re-embeds and similarity search behave sensibly). Uses a hash-seeded PRNG.
 */
function mockEmbed(text) {
  const seedBytes = createHash('sha256').update(text || '').digest();
  let state = seedBytes.readUInt32BE(0) || 1;
  const rand = () => {
    // xorshift32 — cheap, deterministic
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff) * 2 - 1; // [-1, 1)
  };

  const vec = new Array(EMBEDDING_DIM);
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    const v = rand();
    vec[i] = v;
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    vec[i] = Number((vec[i] / norm).toFixed(6));
  }
  return vec;
}
