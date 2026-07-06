/**
 * THE CONTRACT
 * These types must match /docs/contracts.md exactly.
 * If Person 2's actual API response ever differs from this file,
 * that's a contract break — flag it in standup immediately, don't
 * quietly patch around it on the frontend.
 */

// ---------- Submission (raw, what the citizen app sends) ----------

export type Channel = "web" | "whatsapp";

export interface GeoPoint {
  lat: number;
  lng: number;
  ward?: string;
}

export interface Submission {
  id: string;
  timestamp: string;
  channel: Channel;
  raw_text?: string;
  audio_url?: string;
  photo_url?: string;
  language: string;
  geo?: GeoPoint | { ward: string };
  citizen_id_hash: string;
}

// ---------- EnrichedSubmission (post-AI, Person 3's output) ----------

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

export type UrgencyLevel = "Critical" | "High" | "Medium" | "Low";

export interface EnrichedSubmission extends Submission {
  normalized_text_en: string;
  category: IssueCategory;
  need_type: string;
  urgency: UrgencyLevel;
  sentiment?: string;
  canonical_location?: string;
  extracted_entities: string[];
}

// ---------- PriorityItem (dashboard-facing, Person 4's scoring output) ----------

export interface SupportingEvidence {
  submission_id: string;
  raw_text: string;
  normalized_text_en: string;
  language: string;
  geo?: GeoPoint;
  canonical_location?: string;
  validation_context?: string | null;
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
  validation_multiplier: number;
  feasibility_multiplier: number;
  final_score: number;
  reasoning?: {
    demand: string;
    urgency: string;
    equity: string;
    validation: string;
  };
}

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

export interface PriorityItem {
  work_id: string;
  title: string;
  category: IssueCategory;
  demand_score: number;
  demand_count: number;
  hotspot_geo: GeoPoint;
  supporting_evidence: SupportingEvidence[];
  rank: number;
  explanation: string;
  state?: string;
  constituency?: string;
  solution_plan?: SolutionPlan;
  scoring_breakdown?: ScoringBreakdown;
  status?: "Open" | "Resolved";
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
  intensity: number;
  category: IssueCategory;
  demand_count: number;
  constituency?: string;
  work_id?: string;
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

// ---------- MP Command Center ----------

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

