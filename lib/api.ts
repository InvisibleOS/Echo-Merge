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
} from "./types";
import { MOCK_PRIORITIES, MOCK_HOTSPOTS, mockSubmitResponse } from "./mockData";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

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

export async function submitComplaint(
  payload: SubmitPayload
): Promise<SubmitResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800));
    return mockSubmitResponse();
  }

  return safeFetch<SubmitResponse>("/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getPriorities(constituency?: string): Promise<PriorityItem[]> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return MOCK_PRIORITIES;
  }

  const query = constituency ? `?constituency=${encodeURIComponent(constituency)}` : "";
  return safeFetch<PriorityItem[]>(`/priorities${query}`);
}

export async function getHotspots(constituency?: string): Promise<Hotspot[]> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return MOCK_HOTSPOTS;
  }

  const query = constituency ? `?constituency=${encodeURIComponent(constituency)}` : "";
  return safeFetch<Hotspot[]>(`/hotspots${query}`);
}

export async function getSubmissions(
  workId?: string
): Promise<EnrichedSubmission[]> {
  if (USE_MOCK) {
    return [];
  }

  const query = workId ? `?work_id=${encodeURIComponent(workId)}` : "";
  return safeFetch<EnrichedSubmission[]>(`/submissions${query}`);
}

export async function resolvePriority(
  workId: string
): Promise<{ success: boolean }> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return { success: true };
  }

  return safeFetch<{ success: boolean }>(`/priorities/${encodeURIComponent(workId)}/resolve`, {
    method: "PATCH",
  });
}

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

