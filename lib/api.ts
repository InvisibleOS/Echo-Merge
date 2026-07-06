import {
  PriorityItem,
  Hotspot,
  SubmitPayload,
  SubmitResponse,
  EnrichedSubmission,
  ActionCase,
  ConstituencyHealth,
  DepartmentAnalytics,
  GovernanceInsights,
  CopilotResponse,
} from "./types";
import { MOCK_PRIORITIES, MOCK_HOTSPOTS, mockSubmitResponse } from "./mockData";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

/**
 * Every function here maps 1:1 to an endpoint in /docs/contracts.md.
 * Ask Person 2 to confirm paths/shapes on Day 1; re-confirm on Day 3
 * when you flip USE_MOCK off.
 */

async function safeFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API error ${res.status} on ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ---------- POST /submit ----------

export async function submitComplaint(
  payload: SubmitPayload
): Promise<SubmitResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800)); // simulate network delay
    return mockSubmitResponse();
  }

  return safeFetch<SubmitResponse>("/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------- GET /priorities ----------

export async function getPriorities(constituency?: string): Promise<PriorityItem[]> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return MOCK_PRIORITIES;
  }

  const query = constituency ? `?constituency=${encodeURIComponent(constituency)}` : "";
  return safeFetch<PriorityItem[]>(`/priorities${query}`);
}

// ---------- GET /hotspots ----------

export async function getHotspots(constituency?: string): Promise<Hotspot[]> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return MOCK_HOTSPOTS;
  }

  const query = constituency ? `?constituency=${encodeURIComponent(constituency)}` : "";
  return safeFetch<Hotspot[]>(`/hotspots${query}`);
}

// ---------- GET /submissions (used by drill-down, optional filter) ----------

export async function getSubmissions(
  workId?: string
): Promise<EnrichedSubmission[]> {
  if (USE_MOCK) {
    return []; // drill-down uses supporting_evidence embedded in PriorityItem in mock mode
  }

  const query = workId ? `?work_id=${encodeURIComponent(workId)}` : "";
  return safeFetch<EnrichedSubmission[]>(`/submissions${query}`);
}

// ---------- Constituency Intelligence & Action OS ----------

export async function getConstituencyHealth(
  constituency?: string
): Promise<ConstituencyHealth> {
  const query = constituency ? `?constituency=${encodeURIComponent(constituency)}` : "";
  return safeFetch<ConstituencyHealth>(`/dashboard/health${query}`);
}

export async function getCases(params?: {
  constituency?: string;
  status?: string;
}): Promise<ActionCase[]> {
  const query = new URLSearchParams();
  if (params?.constituency) query.set("constituency", params.constituency);
  if (params?.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return safeFetch<ActionCase[]>(`/cases${suffix}`);
}

export async function getDepartmentAnalytics(
  constituency?: string
): Promise<DepartmentAnalytics[]> {
  const query = constituency ? `?constituency=${encodeURIComponent(constituency)}` : "";
  return safeFetch<DepartmentAnalytics[]>(`/dashboard/departments${query}`);
}

export async function getGovernanceInsights(
  constituency?: string
): Promise<GovernanceInsights> {
  const query = constituency ? `?constituency=${encodeURIComponent(constituency)}` : "";
  return safeFetch<GovernanceInsights>(`/dashboard/insights${query}`);
}

export async function askCopilot(
  question: string,
  constituency?: string
): Promise<CopilotResponse> {
  return safeFetch<CopilotResponse>("/copilot", {
    method: "POST",
    body: JSON.stringify({ question, constituency }),
  });
}

export async function updateCaseStatus(
  caseId: string,
  status: string,
  note?: string
): Promise<ActionCase | null> {
  return safeFetch<ActionCase | null>(`/cases/${encodeURIComponent(caseId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, note }),
  });
}
