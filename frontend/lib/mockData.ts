import { PriorityItem, Hotspot, SubmitResponse, EnrichedSubmission } from "./types";
import rawSubmissions from "./day1_enriched_submissions.json";
import rawPrioritiesV2 from "./day1_priorities_v2.json";

/**
 * Real data from Person 4:
 *  - day1_enriched_submissions.json (Jul 2)  -- raw enriched submissions,
 *    pre-scoring. Used here only for the heatmap point density.
 *  - day1_priorities_v2.json (Jul 3)         -- REAL ranked output from
 *    Person 4's actual scoring engine (urgency + ward equity + census
 *    gap + feasibility). This is the real thing GET /priorities will
 *    return once Person 2's endpoint is live -- so we use it directly,
 *    no more locally-computed grouping.
 *
 * Swap to live data by flipping NEXT_PUBLIC_USE_MOCK_DATA=false in
 * .env.local once Person 2's backend is reachable. Nothing else in the
 * app needs to change -- see lib/api.ts.
 */

export const REAL_ENRICHED_SUBMISSIONS =
  rawSubmissions as unknown as EnrichedSubmission[];

export const MOCK_PRIORITIES: PriorityItem[] =
  rawPrioritiesV2 as unknown as PriorityItem[];

// Heatmap uses individual submission points (denser, better-looking map)
// rather than the 37 aggregated priorities.
export const MOCK_HOTSPOTS: Hotspot[] = REAL_ENRICHED_SUBMISSIONS.map((s) => {
  const urgencyWeight: Record<string, number> = {
    Critical: 1,
    High: 0.75,
    Medium: 0.5,
    Low: 0.25,
  };
  return {
    geo: {
      lat: s.geo && "lat" in s.geo ? s.geo.lat : 12.9071,
      lng: s.geo && "lng" in s.geo ? s.geo.lng : 77.5952,
    },
    intensity: urgencyWeight[s.urgency] ?? 0.5,
    category: s.category,
    demand_count: 1,
  };
});

export function mockSubmitResponse(): SubmitResponse {
  return {
    success: true,
    submission_id: `SUB_${Date.now()}`,
    message: "Submission received and queued for processing.",
  };
}
