/**
 * Incremental priority aggregation (Person 2 — Day 3 "triggers rescoring ->
 * updates the priorities table").
 *
 * Person 4 owns the authoritative batch scorer (urgency + ward equity + census
 * gap + feasibility -> the 0–100 demand_score in day1_priorities_v2.json). This
 * module is the *live* path: when one new submission is processed, fold it into
 * the matching priority (same category + ward), recompute a comparable 0–100
 * score, refresh the hotspot centroid + evidence, and re-rank. It keeps the
 * dashboard reactive between batch runs without trying to reimplement Person 4.
 */

const URGENCY_WEIGHT = { Critical: 12, High: 8, Medium: 5, Low: 2 };
const MAX_EVIDENCE = 5;

function wardOf(rawSubmission, enriched) {
  if (rawSubmission?.geo && rawSubmission.geo.ward) return rawSubmission.geo.ward;
  if (enriched?.canonical_location && enriched.canonical_location !== 'nan') {
    return enriched.canonical_location;
  }
  return 'Bengaluru South';
}

/** Heuristic 0–100 score for the live path — comparable to Person 4's scale. */
function computeScore(demandCount, urgency) {
  const urgencyBonus = URGENCY_WEIGHT[urgency] ?? URGENCY_WEIGHT.Medium;
  return Math.min(100, Math.round((10 + demandCount * 8 + urgencyBonus) * 100) / 100);
}

function evidenceEntry(submissionId, rawSubmission, enriched) {
  return {
    submission_id: submissionId,
    raw_text: rawSubmission?.raw_text ?? '',
    normalized_text_en: enriched?.normalized_text_en ?? '',
    language: rawSubmission?.language ?? 'unknown',
  };
}

/**
 * Fold one processed submission into the priorities table, then re-rank.
 * Best-effort: logs and returns on error so a scoring hiccup never fails the
 * citizen's /submit (the raw submission is already safely stored by then).
 */
export async function rescoreForSubmission(supabase, { enriched, submissionId, rawSubmission }) {
  const { category } = enriched;
  const ward = wardOf(rawSubmission, enriched);

  // Match on category + ward (same grouping as Person 4's batch output).
  const { data: candidates, error: fetchErr } = await supabase
    .from('priorities')
    .select('*')
    .eq('category', category);

  if (fetchErr) {
    console.error('[scoring] fetch priorities failed:', fetchErr.message);
    return;
  }

  const existing = (candidates || []).find(
    (p) => p.hotspot_geo && p.hotspot_geo.ward === ward
  );

  const geo = rawSubmission?.geo;
  const hasCoords = geo && Number.isFinite(Number(geo.lat)) && Number.isFinite(Number(geo.lng));

  if (existing) {
    const newCount = existing.demand_count + 1;
    const newScore = computeScore(newCount, enriched.urgency);

    let hotspot_geo = { ...existing.hotspot_geo, ward };
    if (hasCoords) {
      const prevLat = Number(existing.hotspot_geo?.lat ?? geo.lat);
      const prevLng = Number(existing.hotspot_geo?.lng ?? geo.lng);
      hotspot_geo.lat = (prevLat * existing.demand_count + Number(geo.lat)) / newCount;
      hotspot_geo.lng = (prevLng * existing.demand_count + Number(geo.lng)) / newCount;
    }

    const evidence = Array.isArray(existing.supporting_evidence)
      ? [...existing.supporting_evidence]
      : [];
    if (evidence.length < MAX_EVIDENCE) {
      evidence.push(evidenceEntry(submissionId, rawSubmission, enriched));
    }

    const { error } = await supabase
      .from('priorities')
      .update({
        demand_count: newCount,
        demand_score: newScore,
        hotspot_geo,
        supporting_evidence: evidence,
        updated_at: new Date().toISOString(),
      })
      .eq('work_id', existing.work_id);
    if (error) console.error('[scoring] update priority failed:', error.message);
  } else {
    const hotspot_geo = hasCoords
      ? { lat: Number(geo.lat), lng: Number(geo.lng), ward }
      : { lat: 12.9071, lng: 77.5952, ward };

    const { error } = await supabase.from('priorities').insert({
      title: `Address ${category.toLowerCase()} in ${ward}`,
      category,
      demand_score: computeScore(1, enriched.urgency),
      demand_count: 1,
      hotspot_geo,
      supporting_evidence: [evidenceEntry(submissionId, rawSubmission, enriched)],
      rank: null, // assigned by reRank below
      explanation:
        `Live signal: ${enriched.urgency} ${category.toLowerCase()} report in ${ward}. ` +
        `Score will be refined by the batch scorer.`,
    });
    if (error) console.error('[scoring] insert priority failed:', error.message);
  }

  await reRank(supabase);
}

/** Re-rank every priority by demand_score desc. Only writes rows whose rank changed. */
async function reRank(supabase) {
  const { data: rows, error } = await supabase
    .from('priorities')
    .select('work_id, rank, demand_score');
  if (error) {
    console.error('[scoring] rerank fetch failed:', error.message);
    return;
  }
  const sorted = [...(rows || [])].sort(
    (a, b) => Number(b.demand_score) - Number(a.demand_score)
  );
  const updates = [];
  sorted.forEach((row, i) => {
    const newRank = i + 1;
    if (row.rank !== newRank) {
      updates.push(supabase.from('priorities').update({ rank: newRank }).eq('work_id', row.work_id));
    }
  });
  const results = await Promise.allSettled(updates);
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed) console.error(`[scoring] rerank: ${failed}/${updates.length} rank updates failed`);
}
