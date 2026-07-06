import {
  PriorityItem,
  Hotspot,
  SubmitPayload,
  SubmitResponse,
  EnrichedSubmission,
} from "./types";
import { MOCK_PRIORITIES, MOCK_HOTSPOTS, mockSubmitResponse } from "./mockData";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
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

// ---------- PATCH /priorities/:id/resolve ----------

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
