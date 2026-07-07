import {
  PriorityItem,
  Hotspot,
  SubmitPayload,
  SubmitResponse,
  EnrichedSubmission,
} from "./types";
import { MOCK_PRIORITIES, MOCK_HOTSPOTS, mockSubmitResponse } from "./mockData";
import { getSyncedPriorities, updatePriorityStatus, addCitizenComplaint } from "./storageSync";

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
  // Always log to client local storage for real-time tracking in Citizen Dashboard
  if (typeof window !== "undefined") {
    try {
      addCitizenComplaint({
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
    return getSyncedPriorities(MOCK_PRIORITIES);
  }

  const query = constituency ? `?constituency=${encodeURIComponent(constituency)}` : "";
  const raw = await safeFetch<PriorityItem[]>(`/priorities${query}`);
  return getSyncedPriorities(raw);
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
    method: "PATCH",
    body: JSON.stringify({ department }),
  });
}

