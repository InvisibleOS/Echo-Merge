"use client";

import { PriorityItem } from "@/lib/types";
import { CategoryBadge } from "@/components/ui/Badge";
import { Building2, CheckCircle2, DollarSign, ListChecks, Clock, AlertCircle, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import EvidenceAttachments from "./EvidenceAttachments";

interface Props {
  priorities: PriorityItem[];
  sortOrder: "recent" | "oldest";
  onSortChange: (order: "recent" | "oldest") => void;
}

// Read-only management view. Complaints only arrive here AFTER an MP has assigned
// them to a department (from the map / drill-down), so there is deliberately no
// assignment control here — only the already-assigned department is shown.
export default function DelegationPanel({ priorities, sortOrder, onSortChange }: Props) {
  function getStatusBadge(item: PriorityItem) {
    const dept = item.assigned_department || item.solution_plan?.primary_department;
    if (item.status === "Resolved") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-signal-green/15 text-signal-green border border-signal-green/30">
          <CheckCircle2 size={14} />
          <span>Resolved</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-600 border border-purple-500/30">
        <Building2 size={14} />
        <span>Assigned to: {dept || "Department"}</span>
      </span>
    );
  }

  return (
    <div className="space-y-6 animate-[fadeSlideIn_200ms_ease-out]">
      {/* Banner */}
      <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 uppercase tracking-wider mb-1">
            <Building2 size={14} />
            <span>Executive Management &amp; Task Tracking</span>
          </div>
          <h2 className="font-display font-bold text-xl text-surface-900">
            Assigned Work Orders
          </h2>
          <p className="text-xs text-surface-700 mt-0.5">
            Complaints appear here once they&rsquo;ve been delegated to a department from the map. This is a tracking view — assignment happens on the complaint itself.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Simple recency sort — most recent activity first by default */}
          <div className="flex items-center gap-2">
            <label htmlFor="delegation-sort" className="text-[11px] font-semibold text-surface-600 uppercase tracking-wide">
              Sort
            </label>
            <select
              id="delegation-sort"
              value={sortOrder}
              onChange={(e) => onSortChange(e.target.value as "recent" | "oldest")}
              className="px-3 py-1.5 rounded-lg border border-surface-200 bg-white text-xs font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-purple-50 px-4 py-2.5 rounded-xl border border-purple-200 shadow-2xs">
            <ShieldCheck size={18} className="text-purple-600" />
            <div className="text-left">
              <p className="text-xs font-bold text-purple-950">Real-Time Sync</p>
              <p className="text-[10px] text-purple-800">Citizens notified instantly</p>
            </div>
          </div>
        </div>
      </div>

      {priorities.length === 0 ? (
        <div className="bg-white rounded-2xl border border-surface-200 p-12 text-center text-surface-700 shadow-sm">
          <Building2 size={32} className="mx-auto mb-3 text-surface-300" />
          <p className="font-display font-semibold text-base text-surface-900">No assigned work orders yet</p>
          <p className="text-xs mt-1">
            Open a complaint on the map and assign it to a department — it will move here for tracking.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {priorities.map((item) => {
            const plan = item.solution_plan;
            const dept = item.assigned_department || plan?.primary_department;
            const photoImages = (item.supporting_evidence || [])
              .filter((e) => e.has_photo)
              .map((e) => ({ submissionId: e.submission_id }));
            const audioClips = (item.supporting_evidence || [])
              .filter((e) => e.has_audio)
              .map((e) => ({ submissionId: e.submission_id }));

            return (
              <div
                key={item.work_id}
                className="bg-white rounded-2xl border border-surface-200 p-6 shadow-sm transition-all hover:border-purple-500/50 hover:shadow-md"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-surface-100">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface-900 text-white font-mono text-xs font-bold">
                        #{item.rank}
                      </span>
                      <CategoryBadge category={item.category} />
                      <span className="text-xs font-mono font-semibold text-surface-400">ID: {item.work_id}</span>
                      {item.predictive_status && (
                        <span className={clsx(
                          "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shadow-2xs",
                          item.predictive_status === "System-Detected"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        )}>
                          <span>{item.predictive_status === "System-Detected" ? "⚡ System-Detected" : "👤 Confirmed"}</span>
                        </span>
                      )}
                      {item.ingestion_source && (
                        <span className="text-[11px] font-medium text-surface-500 bg-surface-100 px-2 py-0.5 rounded-md border border-surface-200">
                          {item.ingestion_source}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display font-bold text-lg text-surface-900 leading-snug">
                      {item.title}
                    </h3>
                    {(photoImages.length > 0 || audioClips.length > 0) && (
                      <div className="pt-1">
                        <EvidenceAttachments images={photoImages} audios={audioClips} />
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-3">
                    {getStatusBadge(item)}
                  </div>
                </div>

                {/* Assigned department — read-only, prominent */}
                <div className="mt-4 flex flex-wrap items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
                  <Building2 size={16} className="text-purple-600 shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                    Assigned Department:
                  </span>
                  <span className="text-sm font-bold text-purple-900">{dept || "—"}</span>
                </div>

                {/* Solution Plan Summary */}
                {plan ? (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface-50 p-4 rounded-xl border border-surface-200/80">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 flex items-center gap-1">
                        <Building2 size={12} />
                        Primary Department
                      </span>
                      <p className="text-xs font-bold text-surface-900">{plan.primary_department}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 flex items-center gap-1">
                        <DollarSign size={12} />
                        Est. Govt. Budget
                      </span>
                      <p className="text-sm font-bold text-emerald-700">
                        {plan.estimated_budget_inr || plan.estimated_budget_tier}
                      </p>
                      {plan.estimated_budget_inr && (
                        <p className="text-[10px] font-semibold text-surface-500">
                          {plan.estimated_budget_tier} tier &middot; municipal allocation
                        </p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 flex items-center gap-1">
                        <Clock size={12} />
                        Timeline
                      </span>
                      <p className="text-xs font-bold text-surface-900">{plan.remediation_timeline}</p>
                    </div>

                    {plan.action_steps && plan.action_steps.length > 0 && (
                      <div className="md:col-span-3 pt-2 border-t border-surface-200/60 space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 flex items-center gap-1">
                          <ListChecks size={13} />
                          Recommended Remediation Steps:
                        </span>
                        <ul className="list-disc list-inside text-xs text-surface-700 space-y-1 pl-1 font-medium">
                          {plan.action_steps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 p-4 rounded-xl bg-surface-50 border border-surface-200/80 text-xs text-surface-700 font-medium">
                    <AlertCircle size={14} className="inline mr-1 text-surface-400" />
                    No automated AI solution plan available for this issue yet.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
