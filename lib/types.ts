/**
 * THE CONTRACT
 * These types must match /docs/contracts.md exactly.
 * If Person 2's actual API response ever differs from this file,
 * that's a contract break — flag it in standup immediately, don't
 * quietly patch around it on the frontend.
 */

// ---------- Submission (raw, what the citizen app sends) ----------

export type Channel = "web" | "whatsapp"; // "whatsapp" reserved for future, not built

export interface GeoPoint {
  lat: number;
  lng: number;
  // Optional ward label; real geo data (submissions, hotspot centroids) often
  // carries it alongside coordinates. Kept optional so a bare {lat,lng} is valid.
  ward?: string;
}

export interface Submission {
  id: string;
  timestamp: string; // ISO 8601
  channel: Channel;
  raw_text?: string;
  audio_url?: string;
  photo_url?: string;
  // What YOUR citizen form sends: BCP-47 code ("hi", "ta", "te", "en").
  // Note: Person 3's pipeline appears to convert this to a full word
  // ("Hindi", "Tamil") by the time it reaches EnrichedSubmission — see
  // real sample data. That's fine, just don't assume the two stages
  // use the same format.
  language: string;
  geo?: GeoPoint | { ward: string };
  citizen_id_hash: string;
}

// ---------- EnrichedSubmission (post-AI, Person 3's output) ----------

// UPDATED after seeing Person 4's real day1_enriched_submissions.json:
// reality has 12 free-text categories, not the original 10-value enum.
// Kept as `string` so the frontend never crashes on an uncatalogued
// category. FLAG IN STANDUP: confirm this 12-value list is final and
// get Person 2 + Person 3 aligned to it.
export type IssueCategory = string;

export const KNOWN_CATEGORIES = [
  "Mobility - Roads, Footpaths and Infrastructure",
  "Water Supply and Services",
  "Garbage and Unsanitary Practices",
  "Pollution",
  "Traffic and Road Safety",
  "PWD",
  "Streetlights",
  "Sanitation",
  "Electricity and Power Supply",
  "Crime and Safety",
  "Animal Husbandry",
  "Yellow Spot",
] as const;

// Real data uses capitalized strings, not lowercase.
export type UrgencyLevel = "Critical" | "High" | "Medium" | "Low";

export interface EnrichedSubmission extends Submission {
  normalized_text_en: string;
  category: IssueCategory;
  need_type: string;
  urgency: UrgencyLevel;
  sentiment?: string;
  // Real data sometimes literally contains the string "nan" instead of
  // omitting the field (artifact of a Python pipeline). Treat "nan" as
  // "no canonical location" wherever this is read.
  canonical_location?: string;
  extracted_entities: string[];
}

// ---------- PriorityItem (dashboard-facing, Person 4's scoring output) ----------

export interface SupportingEvidence {
  submission_id: string;
  raw_text: string;
  normalized_text_en: string;
  // Real data provides full language names directly ("Hindi", "Tamil"),
  // not BCP-47 codes — stored and displayed as-is, no lookup needed.
  language: string;
  // Optional per-evidence location, shown as a pin in the drill-down panel.
  // Present when the backend carries it through (see lib/server/mappers.ts);
  // absent for older seed data — the UI guards for both.
  geo?: GeoPoint;
  canonical_location?: string;
}

export interface SolutionPlan {
  primary_department: string;
  estimated_budget_tier: string;
  remediation_timeline: string;
  action_steps: string[];
  strategic_rationale: string;
}

export interface ScoringBreakdown {
  base_demand: number;
  urgency_multiplier: number;
  equity_multiplier: number;
  data_gap_multiplier: number;
  feasibility_multiplier: number;
  final_score: number;
}

export interface PriorityItem {
  work_id: string;
  title: string;
  category: IssueCategory;
  // Real data (day1_priorities_v2.json) uses a 0-100 scale, not 0-1 as
  // originally frozen in contracts.md. Flagged to the team 2026-07-03.
  demand_score: number;
  demand_count: number; // number of citizens/submissions behind this
  hotspot_geo: GeoPoint;
  supporting_evidence: SupportingEvidence[];
  rank: number;
  explanation: string; // human-readable "why this is ranked here"
  state?: string;
  constituency?: string;
  solution_plan?: SolutionPlan;
  scoring_breakdown?: ScoringBreakdown;
  department?: DepartmentSummary;
  scheme_matches?: SchemeMatch[];
  priority_band?: string;
  sla_status?: string;
  resolution_brief?: ResolutionBrief;
  budget_recommendation?: BudgetRecommendation;
  impact_prediction?: ImpactPrediction;
}

// ---------- Hotspot (map aggregation) ----------

export interface Hotspot {
  geo: GeoPoint;
  intensity: number; // 0–1, drives heatmap weight
  category: IssueCategory;
  demand_count: number;
}

// ---------- API request/response shapes ----------

export interface SubmitPayload {
  raw_text?: string;
  audio_base64?: string;
  photo_base64?: string;
  language: string;
  geo?: GeoPoint;
  channel: Channel;
}

export interface SubmitResponse {
  success: boolean;
  submission_id: string;
  message: string;
  case_id?: string;
  department?: DepartmentSummary;
  scheme_matches?: SchemeMatch[];
  tracking_url?: string;
}

// ---------- Constituency Intelligence & Action OS ----------

export interface DepartmentSummary {
  id: string;
  name: string;
  short_name: string;
  officer?: string;
  contact?: string;
  sla_hours?: number;
}

export interface SchemeMatch {
  id: string;
  name: string;
  department: string;
  guidance: string;
}

export interface ResolutionBrief {
  summary: string;
  primary_department: string;
  officer: string;
  why_now: string;
  first_action: string;
  recommended_steps: string[];
  schemes: string[];
  citizen_message: string;
}

export interface BudgetRecommendation {
  category: string;
  recommended_budget_tier: string;
  fund_source?: string;
  recommendation?: string;
  rationale?: string;
  expected_impact?: string;
  demand_count?: number;
}

export interface ImpactPrediction {
  affected_citizens_estimate: number;
  public_trust_gain: string;
  risk_if_delayed: string;
}

export interface ActionCase {
  case_id: string;
  work_id: string;
  title: string;
  category: IssueCategory;
  department: DepartmentSummary;
  status: "New" | "Assigned" | "In Progress" | "Resolved" | string;
  priority_score: number;
  priority_band: "Critical" | "High" | "Medium" | "Watch" | string;
  sla_deadline: string;
  sla_status: "On Track" | "At Risk" | "Breached" | "Met" | string;
  citizen_count: number;
  ward: string;
  geo?: GeoPoint;
  resolution_brief: ResolutionBrief;
  scheme_matches: SchemeMatch[];
  evidence: SupportingEvidence[];
  created_at: string;
  updated_at: string;
  latest_update: string;
}

export interface ConstituencyHealth {
  constituency: string;
  health_index: number;
  open_cases: number;
  critical_cases: number;
  sla_breaches: number;
  resolved_this_week: number;
  active_hotspots: number;
  citizen_trust_score: number;
  top_issue: string;
  fastest_department?: string;
  slowest_department?: string;
  trend_label: string;
}

export interface DepartmentAnalytics extends DepartmentSummary {
  active_cases: number;
  total_cases: number;
  sla_breaches: number;
  sla_compliance: number;
  workload_score: number;
  recommended_action: string;
}

export interface GovernanceInsights {
  weekly_brief: string[];
  emerging_issues: {
    title: string;
    severity: string;
    evidence: string;
  }[];
  budget_recommendations: BudgetRecommendation[];
  manifesto_tracking: {
    promise: string;
    linked_category: string;
    progress: number;
    risk: string;
  }[];
  disaster_mode: {
    enabled: boolean;
    trigger: string;
    playbook: string[];
  };
}

export interface CopilotResponse {
  question: string;
  answer: string;
  citations: {
    work_id: string;
    title: string;
    score: number;
  }[];
  suggested_actions: string[];
}
