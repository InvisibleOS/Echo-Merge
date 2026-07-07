import { AiRating, PriorityItem } from "./types";

/**
 * Client-side view helpers for the AI complaint rating.
 *
 * The score is computed on the server (see lib/server/ai-rating.js) and arrives
 * as `PriorityItem.ai_rating`. These helpers only format it for display and
 * provide a graceful fallback if an older payload arrives without a rating.
 */

export const RATING_DIMENSIONS: {
  key: keyof Pick<AiRating, "urgency" | "impact" | "feasibility" | "cost">;
  label: string;
  hint: string;
  tone: string; // text colour for the dimension label
  bar: string; // bar-fill colour
}[] = [
  { key: "urgency", label: "Urgency", hint: "How time / safety critical", tone: "text-red-500", bar: "bg-red-400" },
  { key: "impact", label: "Impact", hint: "How many people affected", tone: "text-civic-500", bar: "bg-civic-400" },
  { key: "feasibility", label: "Feasibility", hint: "How readily the department can fix it", tone: "text-signal-green", bar: "bg-signal-green" },
  { key: "cost", label: "Cost", hint: "Cost-efficiency to resolve (5 = cheap quick win)", tone: "text-purple-500", bar: "bg-purple-400" },
];

export const RATING_TOTAL_MAX = 20;

/** Return the item's rating, or derive a coherent fallback from demand_score. */
export function ratingFor(item: PriorityItem): AiRating {
  if (item.ai_rating && Number.isFinite(item.ai_rating.total)) return item.ai_rating;

  // Fallback: spread the 0–100 demand_score across four 1–5 dimensions so the
  // UI still renders if the server ever omits ai_rating.
  const s = Number(item.demand_score) || 0;
  const base = Math.max(1, Math.min(5, Math.round((s / 100) * 5)));
  const urgency = base;
  const impact = Math.max(1, Math.min(5, Math.round((Number(item.demand_count) || 1) >= 4 ? base + 1 : base)));
  const feasibility = Math.max(1, Math.min(5, 6 - base));
  const cost = feasibility;
  const total = urgency + impact + feasibility + cost;
  return { urgency, impact, feasibility, cost, total, max: RATING_TOTAL_MAX, overall: Math.round((total / RATING_TOTAL_MAX) * 100) };
}
