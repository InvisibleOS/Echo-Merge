"use client";

import { useEffect, useState } from "react";

/**
 * Plays a complaint's attached voice note. Like EvidencePhoto:
 *   - `base64` (+ `mime`): the citizen's own recording, played instantly.
 *   - `submissionId`: any other viewer lazily fetches the stored audio URL from
 *     /api/submissions/media (cached per id). Renders nothing if there is none.
 */

const cache = new Map<string, string | null>(); // submissionId -> audio src (null = none)

interface Props {
  submissionId?: string;
  base64?: string | null;
  mime?: string;
  className?: string;
}

export default function EvidenceAudio({ submissionId, base64, mime, className }: Props) {
  const base64Src = base64 ? `data:${mime || "audio/webm"};base64,${base64}` : null;
  const [fetchedSrc, setFetchedSrc] = useState<string | null>(
    () => (!base64 && submissionId && cache.has(submissionId) ? cache.get(submissionId) ?? null : null)
  );

  useEffect(() => {
    if (base64 || !submissionId || cache.has(submissionId)) return;
    let cancelled = false;
    fetch(`/api/submissions/media?id=${encodeURIComponent(submissionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const url = d?.audio_url ?? null;
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

  return <audio controls src={src} className={className} preload="none" />;
}
