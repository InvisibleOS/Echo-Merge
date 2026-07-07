import rawPriorities from '../day1_priorities_v2.json';
import rawSubmissions from '../day1_enriched_submissions.json';
import { enrich } from './enrichment.js';
import { rateComplaint } from './ai-rating.js';

const DEFAULT_CONSTITUENCY = 'Bengaluru South';
const NOW = () => new Date();

export const DEPARTMENTS = [
  {
    id: 'dept-pwd',
    name: 'Public Works Department',
    short_name: 'PWD',
    categories: ['Mobility - Roads, Footpaths and Infrastructure', 'PWD', 'Traffic and Road Safety'],
    sla_hours: 72,
    officer: 'Executive Engineer',
    contact: 'pwd-control@example.gov.in',
  },
  {
    id: 'dept-water',
    name: 'Water Supply and Sewerage Board',
    short_name: 'Water Board',
    categories: ['Water Supply and Services', 'Sanitation'],
    sla_hours: 48,
    officer: 'Assistant Engineer, Water Services',
    contact: 'water-desk@example.gov.in',
  },
  {
    id: 'dept-solid-waste',
    name: 'Solid Waste Management Cell',
    short_name: 'SWM',
    categories: ['Garbage and Unsanitary Practices', 'Pollution', 'Yellow Spot'],
    sla_hours: 24,
    officer: 'Health Inspector',
    contact: 'swm-cell@example.gov.in',
  },
  {
    id: 'dept-electricity',
    name: 'Electricity and Streetlight Maintenance',
    short_name: 'Power',
    categories: ['Streetlights', 'Electricity and Power Supply'],
    sla_hours: 36,
    officer: 'Junior Engineer, Electrical',
    contact: 'power-desk@example.gov.in',
  },
  {
    id: 'dept-safety',
    name: 'Public Safety and Police Liaison',
    short_name: 'Safety',
    categories: ['Crime and Safety', 'Animal Husbandry'],
    sla_hours: 24,
    officer: 'Nodal Safety Officer',
    contact: 'safety-cell@example.gov.in',
  },
];

export const SCHEMES = [
  {
    id: 'scheme-amrut',
    name: 'AMRUT / Urban Water and Drainage Works',
    department: 'Water Board',
    categories: ['Water Supply and Services', 'Sanitation'],
    guidance: 'Use for water supply gaps, drainage overflow, and sewerage upgrade requests.',
  },
  {
    id: 'scheme-swachh',
    name: 'Swachh Bharat Mission - Urban',
    department: 'SWM',
    categories: ['Garbage and Unsanitary Practices', 'Pollution', 'Yellow Spot'],
    guidance: 'Use for waste collection, garbage hotspots, public toilet, and cleanliness drives.',
  },
  {
    id: 'scheme-smart-roads',
    name: 'Municipal Road Safety and Footpath Fund',
    department: 'PWD',
    categories: ['Mobility - Roads, Footpaths and Infrastructure', 'Traffic and Road Safety', 'PWD'],
    guidance: 'Use for potholes, unsafe footpaths, junction safety, and pedestrian infrastructure.',
  },
  {
    id: 'scheme-saubhagya',
    name: 'Urban Streetlight and Power Reliability Program',
    department: 'Power',
    categories: ['Streetlights', 'Electricity and Power Supply'],
    guidance: 'Use for streetlight repair, dark spots, and power reliability complaints.',
  },
  {
    id: 'scheme-safe-city',
    name: 'Safe City / Community Safety Coordination',
    department: 'Safety',
    categories: ['Crime and Safety', 'Animal Husbandry'],
    guidance: 'Use for safety hotspots, nuisance, unsafe routes, and public-order coordination.',
  },
];

function store() {
  if (!globalThis.__civicActionOsStore) {
    globalThis.__civicActionOsStore = {
      submissions: [],
      cases: [],
      updates: [],
      caseOverrides: {},
    };
  }
  globalThis.__civicActionOsStore.caseOverrides ||= {};
  return globalThis.__civicActionOsStore;
}

export function departmentForCategory(category) {
  return (
    DEPARTMENTS.find((dept) => dept.categories.includes(category)) ||
    DEPARTMENTS[0]
  );
}

export function departmentForId(departmentId) {
  return DEPARTMENTS.find((dept) => dept.id === departmentId) || null;
}

export function schemesForCategory(category) {
  return SCHEMES.filter((scheme) => scheme.categories.includes(category));
}

export async function processOfflineSubmission(value, hash) {
  const id = `SUB-${hash.slice(0, 10).toUpperCase()}`;
  const rawSubmission = {
    id,
    timestamp: NOW().toISOString(),
    channel: value.channel || 'web',
    raw_text: value.raw_text,
    audio_url: value.audio_url,
    photo_url: value.photo_url,
    language: languageName(value.language),
    geo: value.geo || { ward: DEFAULT_CONSTITUENCY },
    citizen_id_hash: value.citizen_id_hash,
  };

  const enriched = await enrich(rawSubmission);
  const department = departmentForCategory(enriched.category);
  const schemes = schemesForCategory(enriched.category);
  const caseItem = buildCaseFromSubmission(rawSubmission, enriched, department, schemes);

  const s = store();
  if (!s.submissions.some((sub) => sub.id === id)) {
    s.submissions.unshift({ ...rawSubmission, ...enriched, department, scheme_matches: schemes });
    s.cases.unshift(caseItem);
  }

  return {
    submission: rawSubmission,
    enrichment: enriched,
    case: caseItem,
    department,
    schemes,
  };
}

export function getActionPriorities({ constituency = '', sortBy = 'rank' } = {}) {
  const liveCases = store().cases;
  const livePriorities = liveCases.map((caseItem, index) => priorityFromCase(caseItem, index + 1));
  const base = rawPriorities.map((item, index) =>
    enrichPriority({ ...item, rank: Number(item.rank || index + 1) + livePriorities.length }, index)
  );
  const all = [...livePriorities, ...base].filter((item) =>
    constituency ? (item.hotspot_geo?.ward || item.constituency || '').includes(constituency) : true
  );

  const sorted = [...all].sort((a, b) => {
    if (sortBy === 'demand_score') return Number(b.demand_score) - Number(a.demand_score);
    const at = a.ai_rating?.total ?? 0;
    const bt = b.ai_rating?.total ?? 0;
    return bt - at || Number(b.demand_score) - Number(a.demand_score);
  });

  return sorted.map((item, index) => ({ ...item, rank: index + 1 }));
}

export function getActionHotspots({ constituency = '' } = {}) {
  const live = store().submissions
    .filter((s) => s.geo && (s.geo.lat != null || s.geo.ward))
    .map((submission) => ({
      geo: {
        lat: Number(submission.geo?.lat ?? 12.9071),
        lng: Number(submission.geo?.lng ?? 77.5952),
        ward: submission.geo?.ward || DEFAULT_CONSTITUENCY,
      },
      intensity: urgencyIntensity(submission.urgency),
      category: submission.category,
      demand_count: 1,
    }));

  const historical = rawSubmissions
    .filter((submission) => submission.geo && submission.geo.lat != null && submission.geo.lng != null)
    .map((submission) => ({
      geo: {
        lat: Number(submission.geo.lat),
        lng: Number(submission.geo.lng),
        ward: submission.geo.ward || DEFAULT_CONSTITUENCY,
      },
      intensity: urgencyIntensity(submission.urgency),
      category: submission.category,
      demand_count: 1,
    }));

  return [...live, ...historical].filter((item) =>
    constituency ? (item.geo.ward || '').includes(constituency) : true
  );
}

export function getActionSubmissions() {
  return [...store().submissions, ...rawSubmissions];
}

export function getCases({ constituency = '', status = '' } = {}) {
  const historical = getActionPriorities({ constituency })
    .filter((priority) => !String(priority.work_id || '').startsWith('LIVE-'))
    .map((priority) => caseFromPriority(priority));
  const live = store().cases;
  return [...live, ...historical]
    .map(applyCaseOverride)
    .filter((item) => (status ? item.status === status : true))
    .filter((item, index, arr) => arr.findIndex((other) => other.case_id === item.case_id) === index)
    .sort((a, b) => Number(b.priority_score) - Number(a.priority_score));
}

export function updateCaseStatus(caseId, status, note = '', departmentId = '') {
  const s = store();
  const existing = s.cases.find((item) => item.case_id === caseId);
  const assignedDepartment = departmentForId(departmentId);
  const update = {
    id: `UPD-${Date.now()}`,
    case_id: caseId,
    status,
    note,
    actor_role: 'department_official',
    created_at: NOW().toISOString(),
  };
  s.updates.unshift(update);
  if (existing) {
    existing.status = status;
    if (assignedDepartment) {
      existing.department = assignedDepartment;
    }
    existing.latest_update = note || `Status changed to ${status}`;
    existing.updated_at = update.created_at;
    return existing;
  }

  const generated = getCases().find((item) => item.case_id === caseId);
  if (generated) {
    s.caseOverrides[caseId] = {
      status,
      ...(assignedDepartment ? { department: assignedDepartment } : {}),
      latest_update: note || `Status changed to ${status}`,
      updated_at: update.created_at,
      sla_status: status === 'Resolved' ? 'Met' : generated.sla_status,
    };
    return applyCaseOverride(generated);
  }

  return null;
}

function applyCaseOverride(caseItem) {
  const override = store().caseOverrides[caseItem.case_id];
  return override ? { ...caseItem, ...override } : caseItem;
}

export function getConstituencyHealth({ constituency = DEFAULT_CONSTITUENCY } = {}) {
  const priorities = getActionPriorities({ constituency });
  const cases = getCases({ constituency });
  const departments = getDepartmentAnalytics({ constituency });
  const hotspots = getActionHotspots({ constituency });
  const critical = priorities.filter((p) => p.priority_band === 'Critical').length;
  const slaBreaches = cases.filter((item) => item.sla_status === 'Breached').length;
  const openCases = cases.filter((item) => item.status !== 'Resolved').length;
  const resolvedCases = cases.filter((item) => item.status === 'Resolved').length;
  const avgScore =
    priorities.reduce((sum, item) => sum + Number(item.demand_score || 0), 0) /
    Math.max(1, priorities.length);
  const healthIndex = Math.max(
    0,
    Math.min(100, Math.round(82 - avgScore * 0.22 - critical * 1.7 - slaBreaches * 2.2 + resolvedCases * 0.8))
  );

  return {
    constituency,
    health_index: healthIndex,
    open_cases: openCases,
    critical_cases: critical,
    sla_breaches: slaBreaches,
    resolved_this_week: Math.max(3, resolvedCases),
    active_hotspots: hotspots.length,
    citizen_trust_score: Math.max(40, Math.min(96, healthIndex + 7 - slaBreaches)),
    top_issue: priorities[0]?.category || 'No dominant issue',
    fastest_department: departments.sort((a, b) => b.sla_compliance - a.sla_compliance)[0]?.name,
    slowest_department: departments.sort((a, b) => a.sla_compliance - b.sla_compliance)[0]?.name,
    trend_label: healthIndex >= 75 ? 'Stable with watch zones' : healthIndex >= 60 ? 'Needs intervention' : 'High-risk week',
  };
}

export function getDepartmentAnalytics({ constituency = DEFAULT_CONSTITUENCY } = {}) {
  const cases = getCases({ constituency });
  return DEPARTMENTS.map((dept) => {
    const owned = cases.filter((item) => item.department.id === dept.id);
    const active = owned.filter((item) => item.status !== 'Resolved').length;
    const breached = owned.filter((item) => item.sla_status === 'Breached').length;
    const avgScore =
      owned.reduce((sum, item) => sum + Number(item.priority_score || 0), 0) /
      Math.max(1, owned.length);
    return {
      id: dept.id,
      name: dept.name,
      short_name: dept.short_name,
      officer: dept.officer,
      contact: dept.contact,
      active_cases: active,
      total_cases: owned.length,
      sla_hours: dept.sla_hours,
      sla_breaches: breached,
      sla_compliance: Math.max(42, Math.round(96 - breached * 11 - active * 1.8)),
      workload_score: Math.min(100, Math.round(active * 8 + avgScore * 0.32)),
      recommended_action:
        breached > 0
          ? 'Escalate overdue field verification today.'
          : active > 8
            ? 'Assign additional field staff for hotspot clearance.'
            : 'Maintain current response cadence.',
    };
  });
}

export function getGovernanceInsights({ constituency = DEFAULT_CONSTITUENCY } = {}) {
  const priorities = getActionPriorities({ constituency, sortBy: 'demand_score' });
  const cases = getCases({ constituency });
  const departments = getDepartmentAnalytics({ constituency });
  const top = priorities[0];
  const slowest = [...departments].sort((a, b) => a.sla_compliance - b.sla_compliance)[0];
  const waterSpike = priorities.find((p) => p.category === 'Water Supply and Services');
  const wasteSpike = priorities.find((p) => /Garbage|Sanitary|Pollution/.test(p.category));

  return {
    weekly_brief: [
      `${constituency} has ${cases.filter((c) => c.status !== 'Resolved').length} active governance cases and ${priorities.length} ranked issue clusters.`,
      top
        ? `Top intervention: ${top.title} with ${top.demand_count} citizen signals and score ${Number(top.demand_score).toFixed(1)}.`
        : 'No urgent cluster detected.',
      `${slowest?.name || 'Departments'} should be monitored for SLA risk on high-priority cases.`,
    ],
    emerging_issues: [
      {
        title: top ? `Escalating ${top.category}` : 'No emerging issue',
        severity: top?.priority_band || 'Watch',
        evidence: top?.explanation || 'Waiting for more citizen signals.',
      },
      {
        title: waterSpike ? 'Water complaints need field validation' : 'Water stable',
        severity: waterSpike && waterSpike.demand_score > 60 ? 'High' : 'Watch',
        evidence: waterSpike?.explanation || 'No unusual water spike in current sample.',
      },
      {
        title: wasteSpike ? 'Sanitation hotspot can be cleared quickly' : 'Sanitation stable',
        severity: wasteSpike && wasteSpike.demand_score > 55 ? 'Medium' : 'Watch',
        evidence: wasteSpike?.explanation || 'Waste reports are below escalation threshold.',
      },
    ],
    budget_recommendations: buildBudgetRecommendations(priorities),
    manifesto_tracking: [
      {
        promise: 'Safer walkable roads and junctions',
        linked_category: 'Mobility - Roads, Footpaths and Infrastructure',
        progress: 62,
        risk: 'Road safety clusters remain high in dense wards.',
      },
      {
        promise: 'Reliable water and sanitation services',
        linked_category: 'Water Supply and Services',
        progress: 58,
        risk: 'Persistent ward-level supply complaints require department review.',
      },
      {
        promise: 'Clean public spaces',
        linked_category: 'Garbage and Unsanitary Practices',
        progress: 71,
        risk: 'Quick wins available through SWM routing and SLA tracking.',
      },
    ],
    disaster_mode: {
      enabled: false,
      trigger: 'Enable when waterlogging, fire, public safety, or weather complaints spike above 3x weekly baseline.',
      playbook: ['Freeze routine queue', 'Prioritize life-safety issues', 'Open ward control room', 'Push public advisories'],
    },
  };
}

function enrichPriority(item, index) {
  const department = departmentForCategory(item.category);
  const schemes = schemesForCategory(item.category);
  const finalScore = Number(item.scoring_breakdown?.final_score || item.demand_score || 0);
  const priorityBand = finalScore >= 75 ? 'Critical' : finalScore >= 55 ? 'High' : finalScore >= 35 ? 'Medium' : 'Watch';

  return {
    ...item,
    rank: item.rank || index + 1,
    state: item.state || 'Karnataka',
    constituency: item.constituency || item.hotspot_geo?.ward || DEFAULT_CONSTITUENCY,
    department,
    scheme_matches: schemes,
    ai_rating: rateComplaint({
      ai_rating: item.ai_rating,
      category: item.category,
      urgency: item.urgency,
      demand_score: finalScore,
      demand_count: item.demand_count,
    }),
    priority_band: priorityBand,
    sla_status: finalScore > 70 ? 'At Risk' : 'On Track',
    resolution_brief: buildResolutionBrief(item, department, schemes),
    budget_recommendation: budgetForCategory(item.category, finalScore),
    impact_prediction: impactPrediction(item, finalScore),
  };
}

function caseFromPriority(priority) {
  const created = dateHoursAgo(8 + (priority.rank || 1) * 3);
  const department = priority.department || departmentForCategory(priority.category);
  const status = priority.rank % 5 === 0 ? 'In Progress' : priority.rank % 7 === 0 ? 'Resolved' : 'New';
  return {
    case_id: `CASE-${String(priority.rank).padStart(3, '0')}`,
    work_id: priority.work_id,
    title: priority.title,
    category: priority.category,
    department,
    status,
    priority_score: Number(priority.demand_score || 0),
    priority_band: priority.priority_band,
    sla_deadline: dateHoursFrom(created, department.sla_hours).toISOString(),
    sla_status: status === 'Resolved' ? 'Met' : priority.demand_score > 74 ? 'At Risk' : 'On Track',
    citizen_count: priority.demand_count,
    ward: priority.hotspot_geo?.ward || DEFAULT_CONSTITUENCY,
    geo: priority.hotspot_geo,
    resolution_brief: priority.resolution_brief,
    scheme_matches: priority.scheme_matches,
    evidence: priority.supporting_evidence || [],
    created_at: created.toISOString(),
    updated_at: dateHoursAgo(priority.rank || 1).toISOString(),
    latest_update: status === 'Resolved' ? 'Completion evidence pending citizen verification.' : 'Awaiting department assignment.',
  };
}

function buildCaseFromSubmission(rawSubmission, enriched, department, schemes) {
  const score = enriched.urgency === 'Critical' ? 88 : enriched.urgency === 'High' ? 72 : 48;
  const created = NOW();
  return {
    case_id: `CASE-${rawSubmission.id.replace(/^SUB-/, '')}`,
    work_id: `LIVE-${rawSubmission.id}`,
    title: `Resolve ${enriched.category.toLowerCase()} report in ${enriched.canonical_location || rawSubmission.geo?.ward || DEFAULT_CONSTITUENCY}`,
    category: enriched.category,
    department,
    status: 'New',
    priority_score: score,
    priority_band: score >= 75 ? 'Critical' : 'High',
    sla_deadline: dateHoursFrom(created, department.sla_hours).toISOString(),
    sla_status: 'On Track',
    citizen_count: 1,
    ward: rawSubmission.geo?.ward || enriched.canonical_location || DEFAULT_CONSTITUENCY,
    geo: rawSubmission.geo,
    resolution_brief: buildResolutionBrief(
      {
        title: enriched.normalized_text_en,
        category: enriched.category,
        demand_count: 1,
        demand_score: score,
        explanation: `Live citizen signal: ${enriched.urgency} urgency, ${enriched.sentiment || 'Concerned'} sentiment.`,
      },
      department,
      schemes
    ),
    scheme_matches: schemes,
    evidence: [
      {
        submission_id: rawSubmission.id,
        raw_text: rawSubmission.raw_text || '',
        normalized_text_en: enriched.normalized_text_en,
        language: rawSubmission.language,
        geo: rawSubmission.geo,
        canonical_location: enriched.canonical_location,
      },
    ],
    created_at: created.toISOString(),
    updated_at: created.toISOString(),
    latest_update: 'AI routed and queued for department review.',
  };
}

function priorityFromCase(caseItem, rank) {
  return {
    work_id: caseItem.work_id,
    title: caseItem.title,
    category: caseItem.category,
    demand_score: caseItem.priority_score,
    demand_count: caseItem.citizen_count,
    hotspot_geo: caseItem.geo || { lat: 12.9071, lng: 77.5952, ward: caseItem.ward },
    supporting_evidence: caseItem.evidence,
    rank,
    explanation: caseItem.resolution_brief.why_now,
    department: caseItem.department,
    scheme_matches: caseItem.scheme_matches,
    ai_rating: rateComplaint({
      category: caseItem.category,
      urgency: caseItem.priority_band === 'Critical' ? 'Critical' : caseItem.priority_band === 'High' ? 'High' : 'Medium',
      demand_score: caseItem.priority_score,
      demand_count: caseItem.citizen_count,
    }),
    priority_band: caseItem.priority_band,
    sla_status: caseItem.sla_status,
    resolution_brief: caseItem.resolution_brief,
    budget_recommendation: budgetForCategory(caseItem.category, caseItem.priority_score),
    impact_prediction: impactPrediction(caseItem, caseItem.priority_score),
  };
}

function buildResolutionBrief(item, department, schemes) {
  const title = item.title || item.normalized_text_en || 'Citizen issue cluster';
  return {
    summary: title,
    primary_department: department.name,
    officer: department.officer,
    why_now:
      item.explanation ||
      `${item.demand_count || 1} citizen signal(s) indicate a ${item.category} issue requiring field verification.`,
    first_action: `Assign ${department.officer} to verify location, estimate scope, and update case status within ${Math.min(24, department.sla_hours)} hours.`,
    recommended_steps: [
      'Verify location and affected households on ground.',
      'Merge duplicate citizen reports into this case cluster.',
      'Publish an expected-resolution timeline for citizens.',
      'Upload completion evidence and request citizen verification.',
    ],
    schemes: schemes.map((scheme) => scheme.name),
    citizen_message:
      'Your issue has been routed to the responsible department. You can track status and verify resolution once work is marked complete.',
  };
}

function buildBudgetRecommendations(priorities) {
  const grouped = new Map();
  priorities.forEach((item) => {
    const current = grouped.get(item.category) || { score: 0, count: 0 };
    current.score += Number(item.demand_score || 0);
    current.count += Number(item.demand_count || 1);
    grouped.set(item.category, current);
  });
  return [...grouped.entries()]
    .map(([category, value]) => ({
      category,
      demand_count: value.count,
      recommended_budget_tier: value.score > 220 ? 'High' : value.score > 120 ? 'Medium' : 'Low',
      rationale: `${value.count} citizen signals and cumulative priority pressure ${value.score.toFixed(1)} suggest this category should be reviewed in the next ward allocation meeting.`,
      expected_impact: value.count > 20 ? 'High visible impact' : 'Targeted local impact',
    }))
    .sort((a, b) => b.demand_count - a.demand_count)
    .slice(0, 5);
}

function budgetForCategory(category, score) {
  return {
    category,
    recommended_budget_tier: score > 70 ? 'High' : score > 45 ? 'Medium' : 'Low',
    fund_source: schemesForCategory(category)[0]?.name || 'Local area development / municipal maintenance budget',
    recommendation:
      score > 70
        ? 'Place in immediate ward works review.'
        : 'Bundle with similar ward-level maintenance requests.',
  };
}

function impactPrediction(item, score) {
  const citizens = Number(item.demand_count || item.citizen_count || 1);
  return {
    affected_citizens_estimate: Math.max(25, citizens * 38),
    public_trust_gain: score > 70 ? 'High' : score > 45 ? 'Medium' : 'Targeted',
    risk_if_delayed:
      score > 70
        ? 'High escalation risk and likely repeat complaints within 7 days.'
        : 'May continue as a localized recurring issue.',
  };
}

function languageName(code) {
  const map = {
    hi: 'Hindi',
    en: 'English',
    ta: 'Tamil',
    te: 'Telugu',
    bn: 'Bengali',
    mr: 'Marathi',
    kn: 'Kannada',
  };
  return map[code] || code || 'Unknown';
}

function urgencyIntensity(urgency) {
  if (urgency === 'Critical') return 1;
  if (urgency === 'High') return 0.78;
  if (urgency === 'Low') return 0.28;
  return 0.52;
}

function dateHoursAgo(hours) {
  return new Date(NOW().getTime() - hours * 60 * 60 * 1000);
}

function dateHoursFrom(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}
