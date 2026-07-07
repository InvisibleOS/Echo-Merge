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
  ProactiveAlert,
} from "./types";
import { MOCK_PRIORITIES, MOCK_HOTSPOTS, mockSubmitResponse } from "./mockData";
import { getSyncedPriorities, updatePriorityStatus, addCitizenComplaint } from "./storageSync";

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
  let res: SubmitResponse;

  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 800));
    res = mockSubmitResponse();
  } else {
    res = await safeFetch<SubmitResponse>("/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  // Always log to client local storage for real-time tracking in Citizen Dashboard
  if (typeof window !== "undefined" && res && res.submission_id) {
    try {
      addCitizenComplaint({
        id: res.submission_id,
        title: payload.raw_text ? payload.raw_text.split(".")[0].slice(0, 60) : "Media Submission",
        raw_text: payload.raw_text,
        photo_base64: payload.photo_base64,
        audio_base64: payload.audio_base64,
        constituency: payload.geo && "ward" in payload.geo ? (payload.geo as { ward?: string }).ward : "Bengaluru South",
      });
    } catch {
      // ignore storage errors
    }
  }

  return res;
}

export async function getPriorities(constituency?: string): Promise<PriorityItem[]> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return getSyncedPriorities(MOCK_PRIORITIES);
  }

  const query = constituency ? `?constituency=${encodeURIComponent(constituency)}` : "";
  const raw = await safeFetch<PriorityItem[]>(`/priorities${query}`);
  return getSyncedPriorities(raw);
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
  // Update local storage sync immediately for real-time cross-tab reflection
  if (typeof window !== "undefined") {
    updatePriorityStatus(workId, "Resolved");
  }

  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return { success: true };
  }

  return safeFetch<{ success: boolean }>(`/priorities/${encodeURIComponent(workId)}/resolve`, {
    method: "PATCH",
  });
}

// ---------- PATCH /priorities/:id/assign ----------

export async function assignPriority(
  workId: string,
  department: string
): Promise<{ success: boolean }> {
  if (typeof window !== "undefined") {
    updatePriorityStatus(workId, "Assigned", department);
  }

  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return { success: true };
  }

  return safeFetch<{ success: boolean }>(`/priorities/${encodeURIComponent(workId)}/assign`, {
    method: "POST",
    body: JSON.stringify({ department }),
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
  note?: string,
  departmentId?: string
): Promise<ActionCase | null> {
  return safeFetch<ActionCase | null>(`/cases/${encodeURIComponent(caseId)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, note, department_id: departmentId }),
  });
}

export async function getProactiveAlerts(): Promise<ProactiveAlert[]> {
  return safeFetch<ProactiveAlert[]>("/proactive");
}

export async function convertProactiveAlert(id: string): Promise<{ success: boolean }> {
  return safeFetch<{ success: boolean }>("/proactive/convert", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}
