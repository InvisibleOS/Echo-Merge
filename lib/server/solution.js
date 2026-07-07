/**
 * Optimal AI solution + government budget estimate for a complaint cluster.
 *
 * Every ranked complaint gets a concrete, actionable remediation plan the MP /
 * department can act on: the accountable department, ordered action steps, a
 * realistic timeline, and — from the government's perspective — an approximate
 * budget (a ₹ range scaled by category, scope, and urgency). Deterministic, so
 * a fresh clone shows a coherent plan for every issue with zero external AI;
 * when a real solution planner writes `solution_plan` to the DB, that wins.
 */

const DEPARTMENT_BY_KEY = {
  water: { name: 'State Water Supply & Sewerage Board', officer: 'Assistant Engineer, Water Supply' },
  waste: { name: 'Municipal Solid Waste Management Department', officer: 'Sanitary Health Inspector' },
  power: { name: 'State Electricity Distribution Company (DISCOM)', officer: 'Junior Engineer, Electrical' },
  roads: { name: 'Public Works Department (PWD)', officer: 'Executive Engineer' },
  safety: { name: 'Public Safety & Police Liaison', officer: 'Nodal Safety Officer' },
  general: { name: 'Municipal Corporation Ward Office', officer: 'Assistant Executive Engineer' },
};

/** category (free text) -> a canonical profile key. */
function profileKey(category) {
  const c = String(category || '').toLowerCase();
  const has = (...w) => w.some((x) => c.includes(x));
  if (has('streetlight', 'light', 'electric', 'power')) return 'power';
  if (has('garbage', 'unsanitary', 'yellow spot', 'sanitation', 'waste', 'pollution')) return 'waste';
  if (has('water', 'drain', 'sewer')) return 'water';
  if (has('road', 'footpath', 'mobility', 'pwd', 'traffic', 'infrastructure', 'pothole')) return 'roads';
  if (has('crime', 'safety', 'animal', 'disaster')) return 'safety';
  return 'general';
}

// Typical municipal remediation cost band per profile (INR), government view.
const COST_BAND = {
  power: [15000, 60000],
  waste: [25000, 120000],
  water: [120000, 700000],
  roads: [200000, 1800000],
  safety: [80000, 450000],
  general: [40000, 300000],
};

const ACTION_STEPS = {
  water: [
    'Depute Assistant Engineer for on-site valve and pressure inspection.',
    'Isolate the affected line and deploy a tanker stop-gap supply.',
    'Repair / replace the failed pipe or sluice and restore pressure.',
    'Confirm supply with affected households and close the ticket.',
  ],
  waste: [
    'Dispatch an SWM clearance crew and mechanical loader to the spot.',
    'Clear accumulated waste and sanitise the black-spot.',
    'Add the location to the daily auto-tipper collection beat.',
    'Photo-verify clearance and request citizen confirmation.',
  ],
  power: [
    'Assign a lineman to inspect the fixture / feeder and log the fault.',
    'Replace the failed lamp, driver, or cable segment.',
    'Test the circuit after dusk to confirm restoration.',
    'Update the maintenance register and close the complaint.',
  ],
  roads: [
    'Depute the Executive Engineer to survey and mark the defect extent.',
    'Barricade the hazard and issue the work order to the ward contractor.',
    'Execute patch / resurfacing or footpath repair as scoped.',
    'Quality-check the finish and publish the completion timeline to citizens.',
  ],
  safety: [
    'Coordinate a joint site visit with the police liaison and ward officer.',
    'Deploy immediate mitigation (patrol, lighting, or signage).',
    'Escalate structural / systemic fixes to the accountable agency.',
    'Confirm the risk is cleared and keep the area under watch.',
  ],
  general: [
    'Assign the ward engineer to verify the issue on the ground.',
    'Merge duplicate citizen reports into this work package.',
    'Execute the remediation and publish an expected-resolution date.',
    'Upload completion evidence and request citizen verification.',
  ],
};

const TIMELINE = {
  power: { Critical: '24–48 hours', High: '2–4 days', default: '3–7 days' },
  waste: { Critical: '24 hours', High: '1–2 days', default: '2–4 days' },
  water: { Critical: '48 hours', High: '3–5 days', default: '5–10 days' },
  roads: { Critical: '3–5 days', High: '1–2 weeks', default: '2–4 weeks' },
  safety: { Critical: '24–72 hours', High: '3–7 days', default: '1–2 weeks' },
  general: { Critical: '2–4 days', High: '4–7 days', default: '1–2 weeks' },
};

function urgencyLabel(rating, demandScore) {
  const u = Number(rating?.urgency);
  if (Number.isFinite(u)) return u >= 5 ? 'Critical' : u >= 4 ? 'High' : u >= 3 ? 'Medium' : 'Low';
  const s = Number(demandScore);
  if (s >= 75) return 'Critical';
  if (s >= 55) return 'High';
  if (s >= 35) return 'Medium';
  return 'Low';
}

function formatINR(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)} L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`;
  return `₹${Math.round(n)}`;
}

/** Government-perspective budget: base band scaled by scope (citizen count) + urgency. */
function budgetFor(key, demandCount, urgency) {
  const [lo, hi] = COST_BAND[key] || COST_BAND.general;
  const scope = 1 + Math.min(2.5, Math.log2((Number(demandCount) || 1) + 1) * 0.35);
  const urg = urgency === 'Critical' ? 1.25 : urgency === 'High' ? 1.1 : 1;
  const low = Math.round((lo * scope * urg) / 1000) * 1000;
  const high = Math.round((hi * scope * urg) / 1000) * 1000;
  const tier = high >= 1500000 ? 'High' : high >= 400000 ? 'Medium' : 'Low';
  return { low, high, tier, label: `${formatINR(low)} – ${formatINR(high)}` };
}

/**
 * Build the optimal solution for a complaint.
 * @param {{title, category, demand_count, demand_score, ai_rating, explanation}} item
 * @returns {{ solution_plan, resolution_brief }}
 */
export function buildOptimalSolution(item = {}) {
  const key = profileKey(item.category);
  const dept = DEPARTMENT_BY_KEY[key];
  const demandCount = Number(item.demand_count) || 1;
  const urgency = urgencyLabel(item.ai_rating, item.demand_score);
  const steps = ACTION_STEPS[key];
  const timeline = (TIMELINE[key] || TIMELINE.general)[urgency] || (TIMELINE[key] || TIMELINE.general).default;
  const budget = budgetFor(key, demandCount, urgency);

  const solution_plan = {
    primary_department: dept.name,
    estimated_budget_tier: budget.tier,
    estimated_budget_inr: budget.label,
    estimated_budget_low: budget.low,
    estimated_budget_high: budget.high,
    remediation_timeline: timeline,
    action_steps: steps,
    strategic_rationale:
      `${demandCount} citizen signal(s) at ${urgency.toLowerCase()} urgency make this a defensible ${budget.tier.toLowerCase()}-cost ` +
      `intervention for ${dept.name}; ${budget.label} covers materials, labour, and verification at current municipal rates.`,
  };

  const resolution_brief = {
    summary: item.title || 'Citizen issue cluster',
    primary_department: dept.name,
    officer: dept.officer,
    why_now:
      item.explanation ||
      `${demandCount} citizen signal(s) indicate a ${item.category || 'civic'} issue requiring field action.`,
    first_action: steps[0],
    recommended_steps: steps,
    schemes: [],
    citizen_message:
      'Your issue has been routed to the responsible department with a budgeted action plan. You can track status and verify resolution once work is marked complete.',
  };

  return { solution_plan, resolution_brief };
}
