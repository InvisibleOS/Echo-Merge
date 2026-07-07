"use client";

import { PriorityItem, CitizenComplaintRecord, ComplaintStatus, KNOWN_CATEGORIES, GeoPoint } from "./types";
import { MOCK_PRIORITIES } from "./mockData";
import { ProactiveAlert } from "./proactiveData";

const OVERRIDES_KEY = "echo_merge_priority_overrides_v1";
const CITIZEN_COMPLAINTS_KEY = "echo_merge_citizen_complaints_v1";
const CONVERTED_PRIORITIES_KEY = "echo_merge_converted_priorities_v1";
const SYNC_EVENT_NAME = "echo-storage-sync";

interface PriorityOverride {
  status: ComplaintStatus;
  assigned_department?: string;
}

/** Emit event across windows and current window */
function emitSyncEvent() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SYNC_EVENT_NAME));
  }
}

/** Get overrides map from localStorage */
function getOverrides(): Record<string, PriorityOverride> {
  if (typeof window === "undefined") return {};
  try {
    const data = localStorage.getItem(OVERRIDES_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

/** Get raw converted priorities from localStorage */
function getConvertedPrioritiesRaw(): PriorityItem[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(CONVERTED_PRIORITIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/** Convert a Proactive Alert into an Actionable PriorityItem and sync across the platform */
export function addConvertedPriority(alert: ProactiveAlert): PriorityItem {
  const current = getConvertedPrioritiesRaw();
  if (current.some((p) => p.work_id === alert.id)) {
    return current.find((p) => p.work_id === alert.id)!;
  }

  const score = alert.priority === "Critical" ? 94.5 : alert.priority === "Warning" ? 82.0 : 71.0;

  const newPriority: PriorityItem = {
    work_id: alert.id,
    rank: 99,
    category: alert.category,
    title: `[PROACTIVE CRAWL] ${alert.title}`,
    demand_count: 1,
    demand_score: score,
    hotspot_geo: alert.geo,
    status: "Open",
    predictive_status: "System-Detected",
    ingestion_source: alert.source,
    assigned_department: alert.department,
    solution_plan: {
      primary_department: alert.department,
      remediation_timeline: alert.priority === "Critical" ? "24-48 Hours (Emergency Response)" : "3-5 Days (Scheduled Maintenance)",
      estimated_budget_tier: alert.priority === "Critical" ? "₹5,00,000 - ₹10,00,000" : "₹1,00,000 - ₹3,00,000",
      action_steps: [
        alert.suggested_action,
        "Verify telemetry sensor baseline after intervention",
        `Log automated maintenance completion report with ${alert.department}`,
      ],
      strategic_rationale: `Automated remediation initiated based on ${alert.ingestion_type} detection from ${alert.source} to prevent critical infrastructure failure.`,
    },
    scoring_breakdown: {
      base_demand: score * 0.75,
      urgency_multiplier: alert.priority === "Critical" ? 0.25 : 0.15,
      equity_multiplier: 0.05,
      validation_multiplier: 0.05,
      feasibility_multiplier: 1.0,
      final_score: score,
    },
    explanation: `Identified proactively via ${alert.ingestion_type}: ${alert.details}`,
    supporting_evidence: [
      {
        submission_id: `SUB_${alert.id}`,
        raw_text: alert.details,
        normalized_text_en: alert.details,
        language: "English",
        geo: alert.geo,
        canonical_location: alert.location_label,
      },
    ],
  };

  const next = [newPriority, ...current];
  try {
    localStorage.setItem(CONVERTED_PRIORITIES_KEY, JSON.stringify(next));
    emitSyncEvent();
  } catch {
    // ignore
  }

  // Also add as a citizen complaint for tracking in Citizen Portal
  addCitizenComplaint({
    title: `[PROACTIVE CRAWL] ${alert.title}`,
    category: alert.category,
    raw_text: `${alert.details} | Source: ${alert.source} | Action: ${alert.suggested_action}`,
    constituency: alert.location_label.split(" ")[0] || "Bengaluru South",
  });

  return newPriority;
}

/** Apply stored status and department overrides to priority items, merging converted proactive items */
export function getSyncedPriorities(defaultPriorities: PriorityItem[]): PriorityItem[] {
  const overrides = getOverrides();
  const converted = getConvertedPrioritiesRaw();
  
  const all = [...defaultPriorities];
  for (const c of converted) {
    if (!all.some((p) => p.work_id === c.work_id)) {
      all.push(c);
    }
  }

  // Sort by score descending so critical alerts take top rank
  all.sort((a, b) => {
    const scoreA = a.scoring_breakdown?.final_score || a.demand_score;
    const scoreB = b.scoring_breakdown?.final_score || b.demand_score;
    return scoreB - scoreA;
  });

  return all.map((item, idx) => {
    const override = overrides[item.work_id];
    if (override) {
      return {
        ...item,
        rank: idx + 1,
        status: override.status,
        assigned_department: override.assigned_department || item.assigned_department,
      };
    }
    return {
      ...item,
      rank: idx + 1,
    };
  });
}

/** Update status or department assignment for a priority in real-time */
export function updatePriorityStatus(
  workId: string,
  status: ComplaintStatus,
  assignedDepartment?: string
) {
  if (typeof window === "undefined") return;
  try {
    const overrides = getOverrides();
    const existing = overrides[workId] || { status: "Open" };
    
    overrides[workId] = {
      status,
      assigned_department: assignedDepartment !== undefined ? assignedDepartment : existing.assigned_department,
    };
    
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));

    // Also update matching citizen complaints if work_id matches
    const complaints = getCitizenComplaintsRaw();
    let updated = false;
    const nextComplaints = complaints.map((c) => {
      if (c.work_id === workId) {
        updated = true;
        return {
          ...c,
          status,
          assigned_department: assignedDepartment !== undefined ? assignedDepartment : c.assigned_department,
        };
      }
      return c;
    });

    if (updated) {
      localStorage.setItem(CITIZEN_COMPLAINTS_KEY, JSON.stringify(nextComplaints));
    }

    emitSyncEvent();
  } catch (err) {
    console.error("Failed to sync priority update:", err);
  }
}

/** Helper to read raw citizen complaints without seeding */
function getCitizenComplaintsRaw(): CitizenComplaintRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(CITIZEN_COMPLAINTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/** Get citizen complaints, seeding initial sample data if empty so the user sees live tracking immediately */
export function getCitizenComplaints(): CitizenComplaintRecord[] {
  if (typeof window === "undefined") return [];
  const raw = getCitizenComplaintsRaw();
  if (raw.length > 0) {
    // Check if any sample complaints correspond to priorities that got updated via overrides
    const overrides = getOverrides();
    return raw.map((c) => {
      if (c.work_id && overrides[c.work_id]) {
        return {
          ...c,
          status: overrides[c.work_id].status,
          assigned_department: overrides[c.work_id].assigned_department || c.assigned_department,
        };
      }
      return c;
    });
  }

  // Seed 4 realistic initial complaints mapped to real MOCK_PRIORITIES so status changes sync dynamically
  const initial: CitizenComplaintRecord[] = [
    {
      id: "CIT_001",
      work_id: MOCK_PRIORITIES[0]?.work_id || "BLR-SOUTH-001",
      title: MOCK_PRIORITIES[0]?.title || "Address garbage and unsanitary practices gap in Bengaluru South",
      category: MOCK_PRIORITIES[0]?.category || KNOWN_CATEGORIES[2] || "Garbage and Unsanitary Practices",
      timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      status: "Ongoing",
      constituency: "Bengaluru South",
      raw_text: "Garbage hasn't been collected for 4 days on 3rd Main Road. Severe stench and street dogs scattering waste.",
    },
    {
      id: "CIT_002",
      work_id: MOCK_PRIORITIES[1]?.work_id || "BLR-SOUTH-002",
      title: MOCK_PRIORITIES[1]?.title || "Address water supply and services gap in Bengaluru South",
      category: MOCK_PRIORITIES[1]?.category || KNOWN_CATEGORIES[1] || "Water Supply and Services",
      timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
      status: "Under Review",
      assigned_department: "State Water Supply & Sewerage Board",
      constituency: "Bengaluru South",
      raw_text: "Irregular drinking water pressure in morning hours. Pipe valve seems damaged near the main junction.",
    },
    {
      id: "CIT_003",
      work_id: MOCK_PRIORITIES[2]?.work_id || "BLR-SOUTH-003",
      title: MOCK_PRIORITIES[2]?.title || "Address mobility - roads, footpaths and infrastructure gap in BTM Layout",
      category: MOCK_PRIORITIES[2]?.category || KNOWN_CATEGORIES[0] || "Mobility - Roads, Footpaths and Infrastructure",
      timestamp: new Date(Date.now() - 3600000 * 72).toISOString(),
      status: "Assigned",
      assigned_department: "Public Works Department (PWD)",
      constituency: "Bengaluru South",
      raw_text: "Deep potholes causing two-wheeler skidding during evening rains. Footpath slabs completely broken.",
    },
    {
      id: "CIT_004",
      work_id: "BLR-SOUTH-999",
      title: "Streetlight malfunction near school crossing",
      category: "Electricity and Power Supply",
      timestamp: new Date(Date.now() - 3600000 * 120).toISOString(),
      status: "Resolved",
      assigned_department: "State Electricity Distribution Company (DISCOM)",
      constituency: "Bengaluru South",
      raw_text: "3 street lights out on school access road. Resolved by the power distribution maintenance crew yesterday.",
    },
  ];

  try {
    localStorage.setItem(CITIZEN_COMPLAINTS_KEY, JSON.stringify(initial));
  } catch {
    // ignore quota errors
  }

  return initial;
}

/** Add a new complaint submitted from the citizen portal */
export function addCitizenComplaint(
  payload: {
    id?: string;
    title: string;
    category?: string;
    raw_text?: string;
    photo_base64?: string;
    audio_base64?: string;
    geo?: GeoPoint;
    constituency?: string;
  }
): CitizenComplaintRecord {
  const current = getCitizenComplaints();
  const newId = payload.id || `CIT_${Date.now()}`;

  // Try to match category or assign a fallback
  const category = payload.category || KNOWN_CATEGORIES[0] || "General Civic Issue";

  const record: CitizenComplaintRecord = {
    id: newId,
    title: payload.title || (payload.raw_text ? payload.raw_text.slice(0, 60) + "..." : "New Civic Submission"),
    category,
    timestamp: new Date().toISOString(),
    status: "Open",
    raw_text: payload.raw_text,
    photo_base64: payload.photo_base64,
    audio_base64: payload.audio_base64,
    // Store the citizen's actual captured location; only tag a constituency when
    // one is genuinely known (no hardcoded "Bengaluru South" for every report).
    geo: payload.geo,
    constituency: payload.constituency,
  };

  const next = [record, ...current];
  try {
    localStorage.setItem(CITIZEN_COMPLAINTS_KEY, JSON.stringify(next));
    emitSyncEvent();
  } catch {
    // ignore
  }

  return record;
}

/** Subscribe to real-time storage sync updates across tabs and current window */
export function subscribeToSync(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  
  const handler = () => callback();
  window.addEventListener(SYNC_EVENT_NAME, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(SYNC_EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}
