"use client";

import { useEffect, useState } from "react";
import { CitizenComplaintRecord, ComplaintStatus } from "@/lib/types";
import { getCitizenComplaints, subscribeToSync } from "@/lib/storageSync";
import { CategoryBadge } from "@/components/ui/Badge";
import { CheckCircle2, Clock, AlertCircle, Building2, MapPin, Calendar, RefreshCw } from "lucide-react";
import clsx from "clsx";
import EvidenceAttachments from "./EvidenceAttachments";

// Cache of coordinate -> place name so we reverse-geocode each spot at most once
// (persisted across sessions). Keyed by coarse (3-dp ~110m) lat,lng.
const GEO_CACHE_KEY = "echo_geo_labels_v1";
function coordKey(lat: number, lng: number) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}
function readGeoCache(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeGeoCache(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

/** Priority status → the status the citizen sees. Anything that isn't an explicit
 *  Assigned/Resolved/Under Review/Ongoing state reads as "Open" for the citizen
 *  (the priorities mapper uses "In Progress" as its unassigned default). */
function normalizeStatus(s?: string): ComplaintStatus {
  if (s === "Assigned" || s === "Resolved" || s === "Under Review" || s === "Ongoing") return s;
  return "Open";
}

/** Map a raw department id ("dept-pwd") to a citizen-friendly agency name.
 *  Already-friendly names (from a priority's solution_plan) pass through. */
function friendlyDept(dep?: string): string | undefined {
  if (!dep) return undefined;
  const d = String(dep);
  if (!d.startsWith("dept-")) return d;
  if (d.includes("water")) return "Water & Sewerage Board";
  if (d.includes("pwd")) return "Roads & Infrastructure";
  if (d.includes("solid-waste")) return "Solid Waste Management";
  if (d.includes("electricity")) return "Power & Electricity Discom";
  if (d.includes("safety")) return "Public Safety";
  return d;
}

export default function CitizenComplaintList() {
  const [complaints, setComplaints] = useState<CitizenComplaintRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // complaint id -> resolved city/town/village name (from evidence or geocoding).
  const [labels, setLabels] = useState<Record<string, string>>({});
  // complaint id -> whether the matched work order has a photo on the server
  // (lets complaints without a locally-stored image still show it).
  const [photoEvidence, setPhotoEvidence] = useState<Record<string, boolean>>({});

  async function syncWithServer(showSpinner = false) {
    if (showSpinner) setIsRefreshing(true);
    const data = getCitizenComplaints();
    setComplaints(data);

    try {
      // Derive live status from /api/priorities rather than the full
      // /api/submissions join: priorities already carry each item's live status +
      // department assignment + supporting evidence, and the endpoint is cached
      // and fast (<1s) — the submissions join is ~5s and times out under polling,
      // which silently left assignments showing as "Open". Each citizen submission
      // is matched to the priority that cites it as supporting evidence.
      const res = await fetch("/api/priorities");
      if (res.ok) {
        const priorities = await res.json();
        const bySubmission = new Map<string, { status: ComplaintStatus; assigned_department?: string }>();
        const byWorkId = new Map<string, { status: ComplaintStatus; assigned_department?: string }>();
        // Place name (city/town/village) captured from the pipeline's reverse-geocode,
        // carried on each evidence entry — free labels for submitted complaints.
        const locBySubmission = new Map<string, string>();
        const locByWorkId = new Map<string, string>();
        // Which submissions / work orders have a photo attached (server-side).
        const photoBySubmission = new Set<string>();
        const photoByWorkId = new Set<string>();

        if (Array.isArray(priorities)) {
          for (const p of priorities) {
            const live = {
              status: normalizeStatus(p.status),
              assigned_department: friendlyDept(p.assigned_department),
            };
            if (p.work_id) byWorkId.set(p.work_id, live);
            const evidence = Array.isArray(p.supporting_evidence) ? p.supporting_evidence : [];
            let firstCanon: string | undefined;
            let anyPhoto = false;
            for (const e of evidence) {
              const subId = e?.submission_id || e?.id;
              if (subId) bySubmission.set(subId, live);
              const canon = typeof e?.canonical_location === "string" ? e.canonical_location : undefined;
              if (canon) {
                if (subId) locBySubmission.set(subId, canon);
                if (!firstCanon) firstCanon = canon;
              }
              if (e?.has_photo) {
                if (subId) photoBySubmission.add(subId);
                anyPhoto = true;
              }
            }
            if (p.work_id && firstCanon) locByWorkId.set(p.work_id, firstCanon);
            if (p.work_id && anyPhoto) photoByWorkId.add(p.work_id);
          }
        }

        // Resolve a display place name per complaint from the evidence we just saw.
        const labelUpdates: Record<string, string> = {};
        const photoUpdates: Record<string, boolean> = {};
        for (const c of data) {
          const canon = locBySubmission.get(c.id) || (c.work_id ? locByWorkId.get(c.work_id) : undefined);
          if (canon) labelUpdates[c.id] = canon;
          if (photoBySubmission.has(c.id) || (c.work_id && photoByWorkId.has(c.work_id))) {
            photoUpdates[c.id] = true;
          }
        }
        if (Object.keys(labelUpdates).length) {
          setLabels((prev) => ({ ...prev, ...labelUpdates }));
        }
        if (Object.keys(photoUpdates).length) {
          setPhotoEvidence((prev) => ({ ...prev, ...photoUpdates }));
        }

        let changed = false;
        const updatedData = data.map((c) => {
          const live = bySubmission.get(c.id) || (c.work_id ? byWorkId.get(c.work_id) : undefined);
          if (live && (c.status !== live.status || c.assigned_department !== live.assigned_department)) {
            changed = true;
            return {
              ...c,
              status: live.status,
              assigned_department: live.assigned_department,
            };
          }
          return c;
        });

        if (changed) {
          localStorage.setItem("echo_merge_citizen_complaints_v1", JSON.stringify(updatedData));
          setComplaints(updatedData);
        }
      }
    } catch (e) {
      console.warn("Failed to sync complaint status:", e);
    }

    if (showSpinner) {
      setIsRefreshing(false);
    }
  }

  function load() {
    syncWithServer(true);
  }

  useEffect(() => {
    // Pull fresh status the instant the list mounts — i.e. every time the user
    // switches to the "My Complaints" page/tab (it remounts on tab change).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncWithServer(false);

    // Re-sync immediately when the tab/window regains focus, so returning from
    // the MP dashboard reflects a just-made assignment without waiting for a poll.
    const onFocus = () => syncWithServer(false);
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncWithServer(false);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    // Cross-window storage events from MP dashboard actions — pull server state
    // too (not just local) so assignments made in another tab show right away.
    const unsubscribe = subscribeToSync(() => {
      syncWithServer(false);
    });

    // Lightweight fallback poll for eventual consistency. Instant updates already
    // come from the focus/visibility/storage triggers above, so this can be gentle
    // — no need to hammer the API every 1.5s (which caused overlapping requests).
    const interval = setInterval(() => {
      syncWithServer(false);
    }, 4000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Fallback: reverse-geocode any complaint that has coordinates but no place name
  // yet (e.g. before the pipeline's canonical_location lands). Cached per coarse
  // coordinate so each spot is looked up at most once, ever.
  useEffect(() => {
    let cancelled = false;
    const pending = complaints.filter(
      (c) => !labels[c.id] && c.geo && typeof c.geo.lat === "number" && typeof c.geo.lng === "number"
    );
    if (!pending.length) return;

    (async () => {
      const cache = readGeoCache();
      const updates: Record<string, string> = {};
      for (const c of pending) {
        const lat = c.geo!.lat as number;
        const lng = c.geo!.lng as number;
        const key = coordKey(lat, lng);
        if (cache[key]) {
          updates[c.id] = cache[key];
          continue;
        }
        try {
          const r = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
          if (r.ok) {
            const d = await r.json();
            if (d?.label) {
              updates[c.id] = d.label;
              cache[key] = d.label;
            }
          }
        } catch {
          // ignore — falls back to constituency / no label
        }
      }
      writeGeoCache(cache);
      if (!cancelled && Object.keys(updates).length) {
        setLabels((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [complaints, labels]);

  function getStatusBadge(status: ComplaintStatus, assignedDept?: string) {
    switch (status) {
      case "Resolved":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-signal-green/15 text-signal-green border border-signal-green/30 shadow-sm">
            <CheckCircle2 size={13} />
            <span>Resolved</span>
          </span>
        );
      case "Assigned":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-600 border border-purple-500/30 shadow-sm" title={`Assigned to ${assignedDept || "Department"}`}>
            <Building2 size={13} />
            <span>Assigned: {assignedDept || "Agency"}</span>
          </span>
        );
      case "Under Review":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 border border-blue-500/30 shadow-sm">
            <Clock size={13} />
            <span>Under Review</span>
          </span>
        );
      case "Ongoing":
      case "Open":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-signal-amber/15 text-amber-700 border border-signal-amber/30 shadow-sm">
            <AlertCircle size={13} />
            <span>Open &bull; Pending Action</span>
          </span>
        );
    }
  }

  return (
    <div className="space-y-6 animate-[fadeSlideIn_200ms_ease-out]">
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-surface-200 shadow-sm">
        <div>
          <h2 className="font-display font-bold text-lg text-surface-900">
            My Civic Submissions &amp; Status Tracker
          </h2>
          <p className="text-xs text-surface-700 mt-0.5">
            Real-time updates from your constituency representatives and municipal agencies.
          </p>
        </div>
        
        <button
          onClick={load}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-surface-100 text-surface-700 hover:bg-surface-200 hover:text-surface-900 transition-colors disabled:opacity-50 border border-surface-200 shadow-sm"
          title="Refresh status"
        >
          <RefreshCw size={14} className={clsx(isRefreshing && "animate-spin")} />
          <span>Sync Status</span>
        </button>
      </div>

      {complaints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center text-surface-700">
          <AlertCircle size={32} className="mx-auto mb-3 text-surface-300" />
          <p className="font-display font-semibold text-base text-surface-900">No submissions recorded yet</p>
          <p className="text-xs mt-1">Switch to the &ldquo;Submit Complaint&rdquo; tab to report a civic issue in your neighborhood.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {complaints.map((item) => {
            const rec = item as CitizenComplaintRecord & { predictive_status?: string };
            return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm transition-all hover:border-civic-500/50 hover:shadow-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3.5 border-b border-surface-100">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryBadge category={item.category} />
                    {(() => {
                      // Show the city/town/village name, not raw coordinates.
                      const place = labels[item.id] || item.location_label || item.constituency;
                      const hasGeo = item.geo && typeof item.geo.lat === "number";
                      if (!place && !hasGeo) return null;
                      return (
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-surface-700 bg-surface-100 px-2.5 py-0.5 rounded-full border border-surface-200"
                          title="Location of the reported issue"
                        >
                          <MapPin size={11} />
                          {place || "Locating…"}
                        </span>
                      );
                    })()}
                    {rec.predictive_status && (
                      <span className={clsx(
                        "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shadow-2xs",
                        rec.predictive_status === "System-Detected"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      )}>
                        <span>{rec.predictive_status === "System-Detected" ? "⚡ System-Detected" : "👤 Confirmed"}</span>
                      </span>
                    )}
                  </div>
                  <h3 className="font-display font-bold text-base text-surface-900">
                    {item.title}
                  </h3>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {getStatusBadge(item.status, item.assigned_department)}
                </div>
              </div>

              {item.raw_text && (
                <p className="text-sm text-surface-700 mt-3.5 bg-surface-50 p-3.5 rounded-xl border border-surface-200/80 leading-relaxed">
                  &ldquo;{item.raw_text}&rdquo;
                </p>
              )}

              {(item.photo_base64 || photoEvidence[item.id]) && (
                <div className="mt-3.5">
                  <EvidenceAttachments
                    images={item.photo_base64 ? [{ base64: item.photo_base64 }] : [{ submissionId: item.id }]}
                  />
                </div>
              )}

              <div className="mt-4 pt-2 flex items-center justify-between text-xs text-surface-700/70 font-medium">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  Reported on {new Date(item.timestamp).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                
                <span className="text-[11px] font-mono text-surface-300 font-semibold">
                  ID: {item.id}
                </span>
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
}
