/**
 * AI complaint rating (the priority score).
 *
 * The AI judges each complaint and rates it 1–5 on FOUR dimensions:
 *
 *   urgency      — how time / safety critical it is
 *   impact       — how many people it affects / how severe
 *   feasibility  — how readily the responsible department can resolve it
 *   cost         — cost-EFFICIENCY of resolving it (5 = cheap quick win, 1 = very expensive)
 *
 * Overall score = sum of the four ÷ 20 (each is 1–5, so max = 4 × 5 = 20).
 * No weighted formula — a plain sum, exactly one rating per dimension. Ranking
 * is by that sum (higher = higher priority), so every dimension is oriented so
 * that 5 always means "more deserving of priority" (that's why `cost` is rated
 * as efficiency, not raw expense — otherwise an expensive project would wrongly
 * inflate the score).
 *
 * A real Gemini enrichment service can return `ai_rating` directly and it is
 * used as-is; offline, this module derives the four ratings deterministically
 * from the AI-enriched signals (category, urgency, citizen demand) so a fresh
 * clone still shows a coherent, explainable score with zero external AI.
 */

export const RATING_MAX = 5;
export const RATING_TOTAL_MAX = 20;

export const RATING_DIMENSIONS = [
  { key: 'urgency', label: 'Urgency', hint: 'How time / safety critical' },
  { key: 'impact', label: 'Impact', hint: 'How many people affected / how severe' },
  { key: 'feasibility', label: 'Feasibility', hint: 'How readily the department can fix it' },
  { key: 'cost', label: 'Cost', hint: 'Cost-efficiency to resolve (5 = cheap quick win)' },
];

function clamp5(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 3;
  return Math.max(1, Math.min(5, v));
}

/** Resolve an urgency label from an explicit string or a 0–100 legacy score. */
function resolveUrgency(urgency, demandScore) {
  const u = String(urgency || '').toLowerCase();
  if (u.startsWith('crit')) return 'Critical';
  if (u.startsWith('high')) return 'High';
  if (u.startsWith('med')) return 'Medium';
  if (u.startsWith('low')) return 'Low';
  const s = Number(demandScore);
  if (Number.isFinite(s)) {
    if (s >= 75) return 'Critical';
    if (s >= 55) return 'High';
    if (s >= 35) return 'Medium';
    return 'Low';
  }
  return 'Medium';
}

const URGENCY_SCORE = { Critical: 5, High: 4, Medium: 3, Low: 2 };

// Issue-severity keywords let a genuinely urgent hazard (an open manhole, a gas
// leak, a wall collapse) score high urgency even when only ONE citizen has
// reported it — safety can't wait for demand to accumulate. Matched against the
// complaint title + category + explanation. First (highest) tier wins.
const HAZARD_URGENCY = [
  { score: 5, kw: ['manhole', 'open drain', 'building collapse', 'wall collapse', 'collapse', 'cave-in', 'caved in', 'sinkhole', 'gas leak', 'explosion', 'explode', 'fire', 'electrocut', 'live wire', 'exposed wire', 'short circuit', 'burst', 'rupture', 'landslide', 'drown', 'submerged'] },
  { score: 4, kw: ['sewage', 'sewer', 'no water', 'water shortage', 'contaminat', 'waterlogging', 'waterlogged', 'flood', 'overflow', 'power outage', 'power cut', 'no electricity', 'transformer', 'accident', 'encroachment', 'blocked road', 'stagnant', 'dengue', 'outbreak', 'water leak', 'hazard'] },
  { score: 3, kw: ['pothole', 'garbage', 'waste', 'litter', 'streetlight', 'street light', 'footpath', 'pole', 'stray', 'tree', 'signal', 'traffic', 'noise', 'pruning'] },
];

/** Highest urgency (1–5) implied by hazard keywords in the text; 0 if none. */
function hazardUrgency(text) {
  for (const tier of HAZARD_URGENCY) {
    if (tier.kw.some((w) => text.includes(w))) return tier.score;
  }
  return 0;
}

// Quick, cheap operational fixes are highly feasible + cost-efficient whatever
// their broad category; genuine capital works are slow + expensive. These
// title-keyword overrides correct category-level guesses — e.g. an "open manhole"
// filed under Crime & Safety is actually a cheap, quick municipal fix, not a
// low-feasibility police matter. Capital works are checked first.
const CAPITAL_WORK_KW = ['collapse', 'flyover', 'bridge', 'underpass', 'resurfac', 'new road', 'road widening', 'pipeline', 'sewer line', 'treatment plant', 'stp', 'pumping station', 'reservoir', 'retaining wall', 'culvert'];
const QUICK_WIN_KW = ['manhole', 'streetlight', 'street light', 'bulb', 'lamp', 'garbage', 'waste', 'litter', 'pothole', 'footpath', 'signage', 'sign board', 'stray', 'tree', 'pruning', 'desilt'];

/** Optional feasibility/cost override from the issue text (null = use category). */
function operationalOverride(text) {
  if (CAPITAL_WORK_KW.some((w) => text.includes(w))) return { feasibility: 2, cost: 2 };
  if (QUICK_WIN_KW.some((w) => text.includes(w))) return { feasibility: 5, cost: 5 };
  return null;
}

/** More citizen signals + higher urgency ⇒ broader impact. */
function impactScore(demandCount, urgencyLabel) {
  const n = Number(demandCount) || 1;
  let s = n >= 12 ? 5 : n >= 7 ? 4 : n >= 4 ? 3 : n >= 2 ? 2 : 1;
  if (urgencyLabel === 'Critical') s += 1;
  else if (urgencyLabel === 'Low') s -= 1;
  return clamp5(s);
}

/**
 * Per-category operational profile. Quick operational fixes (a bulb, a garbage
 * run) are highly feasible and cheap; capital works (a new road, a pipeline, a
 * police station) are slow and expensive. `cost` is efficiency: 5 = cheapest.
 */
function categoryProfile(category) {
  const c = String(category || '').toLowerCase();
  const has = (...words) => words.some((w) => c.includes(w));

  if (has('streetlight', 'light')) return { feasibility: 5, cost: 5 };
  if (has('garbage', 'unsanitary', 'yellow spot', 'sanitation', 'waste'))
    return { feasibility: 5, cost: 5 };
  if (has('electric', 'power')) return { feasibility: 4, cost: 4 };
  if (has('animal')) return { feasibility: 4, cost: 4 };
  if (has('pollution')) return { feasibility: 3, cost: 3 };
  if (has('water', 'drain', 'sewer')) return { feasibility: 3, cost: 3 };
  if (has('crime', 'safety')) return { feasibility: 2, cost: 3 };
  if (has('disaster')) return { feasibility: 2, cost: 2 };
  if (has('road', 'footpath', 'mobility', 'pwd', 'traffic', 'infrastructure'))
    return { feasibility: 2, cost: 2 };
  return { feasibility: 3, cost: 3 };
}

function finalize(r) {
  const rating = {
    urgency: clamp5(r.urgency),
    impact: clamp5(r.impact),
    feasibility: clamp5(r.feasibility),
    cost: clamp5(r.cost),
  };
  const total = rating.urgency + rating.impact + rating.feasibility + rating.cost;
  return {
    ...rating,
    total,
    max: RATING_TOTAL_MAX,
    overall: Math.round((total / RATING_TOTAL_MAX) * 100),
  };
}

/** True when an object already carries all four explicit 1–5 ratings. */
function hasExplicitRating(r) {
  return (
    r &&
    ['urgency', 'impact', 'feasibility', 'cost'].every((k) => Number.isFinite(Number(r[k])))
  );
}

/**
 * Rate a complaint / priority cluster 1–5 on the four dimensions.
 * @param {object} signals { ai_rating?, category, urgency?, demand_score?, demand_count? }
 * @returns {{urgency,impact,feasibility,cost,total,max,overall}}
 */
export function rateComplaint(signals = {}) {
  if (hasExplicitRating(signals.ai_rating)) return finalize(signals.ai_rating);

  const text = `${signals.title || ''} ${signals.category || ''} ${signals.explanation || ''}`.toLowerCase();

  // Urgency is the greater of the demand/enrichment signal and the intrinsic
  // hazard severity — so an open manhole is urgent on its own merit, not only
  // once many citizens have piled on.
  const demandUrgency = URGENCY_SCORE[resolveUrgency(signals.urgency, signals.demand_score)] ?? 3;
  const urgency = clamp5(Math.max(demandUrgency, hazardUrgency(text)));
  const urgencyLabel =
    urgency >= 5 ? 'Critical' : urgency >= 4 ? 'High' : urgency >= 3 ? 'Medium' : 'Low';

  const base = categoryProfile(signals.category);
  const override = operationalOverride(text);

  return finalize({
    urgency,
    impact: impactScore(signals.demand_count, urgencyLabel),
    feasibility: override ? override.feasibility : base.feasibility,
    cost: override ? override.cost : base.cost,
  });
}
