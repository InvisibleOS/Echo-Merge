/**
 * Media persistence for /submit (Person 2).
 *
 * The citizen form sends voice/photo as RAW base64 (data-URL prefix stripped —
 * see VoiceRecorder/PhotoUpload). This turns that base64 into a durable URL to
 * store in submissions.audio_url / photo_url:
 *
 *   - If SUPABASE_MEDIA_BUCKET is set, upload to Supabase Storage and return the
 *     public URL (production path). Path is derived from the content key so a
 *     re-submission upserts to the same object instead of duplicating.
 *   - Otherwise fall back to a self-contained `data:` URI so the whole flow
 *     (submit → drill-down playback/preview) works with zero extra infra.
 *
 * MIME is sniffed from magic bytes so the URL/data-URI is renderable/playable.
 */

const DATA_URI_WARN_BYTES = 3 * 1024 * 1024; // warn past ~3MB when no bucket

export async function persistMedia(supabase, { audio_base64, photo_base64 }, keyHint) {
  const warnings = [];
  const out = { audio_url: null, photo_url: null, warnings };

  if (audio_base64) {
    out.audio_url = await store(supabase, audio_base64, sniff(audio_base64, 'audio'), `${keyHint}-audio`, warnings);
  }
  if (photo_base64) {
    out.photo_url = await store(supabase, photo_base64, sniff(photo_base64, 'image'), `${keyHint}-photo`, warnings);
  }
  return out;
}

async function store(supabase, base64, { mime, ext }, key, warnings) {
  const bucket = process.env.SUPABASE_MEDIA_BUCKET;
  if (bucket) {
    try {
      const buffer = Buffer.from(base64, 'base64');
      const path = `${key}.${ext}`;
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, buffer, { contentType: mime, upsert: true });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (data?.publicUrl) return data.publicUrl;
      throw new Error('no public URL returned');
    } catch (err) {
      warnings.push(`media upload failed (${err.message}); using data URI fallback.`);
    }
  }
  // Fallback: inline data URI (works without a storage bucket).
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > DATA_URI_WARN_BYTES) {
    warnings.push(`large media (~${Math.round(approxBytes / 1024)}KB) stored inline; configure SUPABASE_MEDIA_BUCKET for production.`);
  }
  return `data:${mime};base64,${base64}`;
}

/** Detect MIME + extension from the leading bytes of base64 content. */
function sniff(base64, kind) {
  let head;
  try {
    head = Buffer.from(base64.slice(0, 64), 'base64');
  } catch {
    head = Buffer.alloc(0);
  }
  const b = (i) => head[i];
  const ascii = (i, s) => head.slice(i, i + s.length).toString('latin1') === s;

  if (kind === 'image') {
    if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
    if (b(0) === 0x89 && ascii(1, 'PNG')) return { mime: 'image/png', ext: 'png' };
    if (ascii(0, 'GIF8')) return { mime: 'image/gif', ext: 'gif' };
    if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) return { mime: 'image/webp', ext: 'webp' };
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  // audio
  if (ascii(0, 'OggS')) return { mime: 'audio/ogg', ext: 'ogg' };
  if (b(0) === 0x1a && b(1) === 0x45 && b(2) === 0xdf && b(3) === 0xa3) return { mime: 'audio/webm', ext: 'webm' };
  if (ascii(0, 'ID3') || (b(0) === 0xff && (b(1) & 0xe0) === 0xe0)) return { mime: 'audio/mpeg', ext: 'mp3' };
  if (ascii(0, 'RIFF') && ascii(8, 'WAVE')) return { mime: 'audio/wav', ext: 'wav' };
  if (ascii(4, 'ftyp')) return { mime: 'audio/mp4', ext: 'm4a' };
  return { mime: 'audio/webm', ext: 'webm' };
}
