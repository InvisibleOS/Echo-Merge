"use client";

import { useEffect, useState } from "react";
import { CitizenComplaintRecord, ComplaintStatus } from "@/lib/types";
import { getCitizenComplaints, subscribeToSync } from "@/lib/storageSync";
import { CategoryBadge } from "@/components/ui/Badge";
import { CheckCircle2, Clock, AlertCircle, Building2, MapPin, Calendar, RefreshCw } from "lucide-react";
import clsx from "clsx";

export default function CitizenComplaintList() {
  const [complaints, setComplaints] = useState<CitizenComplaintRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function syncWithServer(showSpinner = false) {
    if (showSpinner) setIsRefreshing(true);
    let data = getCitizenComplaints();
    setComplaints(data);

    try {
      const res = await fetch("/api/submissions");
      if (res.ok) {
        const liveSubmissions = await res.json();
        const statusMap = new Map();
        for (const sub of liveSubmissions) {
          statusMap.set(sub.id, {
            status: sub.status,
            assigned_department: sub.assigned_department
          });
        }

        let changed = false;
        const updatedData = data.map((c) => {
          const live = statusMap.get(c.id);
          if (live && (c.status !== live.status || c.assigned_department !== live.assigned_department)) {
            changed = true;
            return {
              ...c,
              status: live.status,
              assigned_department: live.assigned_department
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
      console.warn("Failed to sync complaints with server:", e);
    }

    if (showSpinner) {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }

  function load() {
    syncWithServer(true);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      syncWithServer(false);
    }, 0);

    // Subscribe to real-time storage events from MP dashboard actions
    const unsubscribe = subscribeToSync(() => {
      setComplaints(getCitizenComplaints());
    });
    
    // Fallback polling every 3s to guarantee server and cross-window sync
    const interval = setInterval(() => {
      syncWithServer(false);
    }, 3000);

    return () => {
      clearTimeout(timer);
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

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
                    {item.geo && typeof item.geo.lat === "number" ? (
                      <span
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-surface-700 bg-surface-100 px-2.5 py-0.5 rounded-full border border-surface-200"
                        title="Location captured at submission"
                      >
                        <MapPin size={11} />
                        {item.geo.lat.toFixed(4)}, {item.geo.lng.toFixed(4)}
                      </span>
                    ) : item.constituency ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-surface-700 bg-surface-100 px-2.5 py-0.5 rounded-full border border-surface-200">
                        <MapPin size={11} />
                        {item.constituency}
                      </span>
                    ) : null}
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

              {item.photo_base64 && (
                <div className="mt-3.5">
                  <span className="inline-flex items-center gap-1 text-xs text-civic-700 font-medium bg-civic-50 px-2.5 py-1 rounded-lg border border-civic-200">
                    📷 Photo evidence attached
                  </span>
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
