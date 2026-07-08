"use client";

import { useEffect, useState } from "react";

/**
 * Renders one complaint photo. Two sources, both handled here:
 *   - `base64`: the citizen's own freshly-attached image (from local storage) —
 *     rendered instantly, MIME sniffed from the bytes.
 *   - `submissionId`: any other viewer (e.g. the MP) lazily fetches the stored
 *     URL from /api/submissions/media. Results are cached per id for the session
 *     so the same image is never fetched twice.
 *
 * Renders nothing when there is no photo. Used inside the EvidenceAttachments
 * lightbox (images are only requested once the viewer opens it).
 */

const cache = new Map<string, string | null>(); // submissionId -> photo src (null = none)

function sniffImageMime(b64: string): string {
  try {
    const bin = atob(b64.slice(0, 16));
    const code = (i: number) => bin.charCodeAt(i);
    if (code(0) === 0xff && code(1) === 0xd8) return "image/jpeg";
    if (code(0) === 0x89 && bin.substring(1, 4) === "PNG") return "image/png";
    if (bin.substring(0, 4) === "GIF8") return "image/gif";
    if (bin.substring(0, 4) === "RIFF" && bin.substring(8, 12) === "WEBP") return "image/webp";
  } catch {
    // fall through
  }
  return "image/jpeg";
}

interface Props {
  submissionId?: string;
  base64?: string | null;
  alt?: string;
  className?: string;
}

export default function EvidencePhoto({ submissionId, base64, alt = "Attached photo", className }: Props) {
  const base64Src = base64 ? `data:${sniffImageMime(base64)};base64,${base64}` : null;
  const [fetchedSrc, setFetchedSrc] = useState<string | null>(
    () => (!base64 && submissionId && cache.has(submissionId) ? cache.get(submissionId) ?? null : null)
  );

  useEffect(() => {
    if (base64 || !submissionId || cache.has(submissionId)) return;
    let cancelled = false;
    fetch(`/api/submissions/media?id=${encodeURIComponent(submissionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const url = d?.photo_url ?? null;
        cache.set(submissionId, url);
        if (!cancelled) setFetchedSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFetchedSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId, base64]);

  const src =
    base64Src ??
    (submissionId && cache.has(submissionId) ? cache.get(submissionId) ?? null : fetchedSrc);

  if (!src) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} loading="lazy" />
  );
}
