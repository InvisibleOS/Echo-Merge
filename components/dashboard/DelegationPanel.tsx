"use client";

import { useState } from "react";
import { PriorityItem } from "@/lib/types";
import { assignPriority } from "@/lib/api";
import { CategoryBadge } from "@/components/ui/Badge";
import { Building2, CheckCircle2, Clock, ShieldCheck, DollarSign, ListChecks, Send, AlertCircle } from "lucide-react";
import clsx from "clsx";
import EvidenceAttachments from "./EvidenceAttachments";

interface Props {
  priorities: PriorityItem[];
  onDelegationUpdate: () => void;
  sortOrder: "recent" | "oldest";
  onSortChange: (order: "recent" | "oldest") => void;
}

const AGENCIES = [
  "Public Works Department (PWD)",
  "Municipal Corporation – Roads & Infrastructure",
  "State Water Supply & Sewerage Board",
  "State Electricity Distribution Company (DISCOM)",
  "Municipal Solid Waste Management Department",
  "State Traffic Police",
  "Municipal Health & Sanitation Department",
  "Local Ward Contractor",
];

export default function DelegationPanel({ priorities, onDelegationUpdate, sortOrder, onSortChange }: Props) {
  const [selectedDepts, setSelectedDepts] = useState<Record<string, string>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [justAssigned, setJustAssigned] = useState<Record<string, string>>({});

  async function handleAssign(item: PriorityItem) {
    const dept = selectedDepts[item.work_id] || item.solution_plan?.primary_department || AGENCIES[0];
    setAssigningId(item.work_id);
    
    try {
      await assignPriority(item.work_id, dept);
      setJustAssigned((prev) => ({ ...prev, [item.work_id]: dept }));
      onDelegationUpdate();
    } catch (err) {
      console.error("Failed to assign:", err);
    } finally {
      setAssigningId(null);
    }
  }

  function getStatusBadge(item: PriorityItem) {
    const assigned = justAssigned[item.work_id] || item.assigned_department;
    if (item.status === "Resolved") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-signal-green/15 text-signal-green border border-signal-green/30">
          <CheckCircle2 size={14} />
          <span>Resolved</span>
        </span>
      );
    }
    if (item.status === "Assigned" || assigned) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-600 border border-purple-500/30">
          <Building2 size={14} />
          <span>Assigned to: {assigned}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-signal-amber/15 text-amber-700 border border-signal-amber/30">
        <Clock size={14} />
        <span>Pending Delegation</span>
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
            <span>Executive Management &amp; Task Delegation</span>
          </div>
          <h2 className="font-display font-bold text-xl text-surface-900">
            Agency Assignment &amp; Solution Execution
          </h2>
          <p className="text-xs text-surface-700 mt-0.5">
            Review AI-generated remediation budgets and assign actionable work packages directly to municipal departments.
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

      {/* List of Priorities with Delegation Controls */}
      <div className="space-y-4">
        {priorities.map((item) => {
          const plan = item.solution_plan;
          const assigned = justAssigned[item.work_id] || item.assigned_department;
          const currentSelect = selectedDepts[item.work_id] || plan?.primary_department || AGENCIES[0];
          const isAssigning = assigningId === item.work_id;
          const photoImages = (item.supporting_evidence || [])
            .filter((e) => e.has_photo)
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
                  {photoImages.length > 0 && (
                    <div className="pt-1">
                      <EvidenceAttachments images={photoImages} />
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-3">
                  {getStatusBadge(item)}
                </div>
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

              {/* Delegation Action Controls */}
              <div className="mt-6 pt-4 border-t border-surface-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                  <label htmlFor={`assign-dept-${item.work_id}`} className="text-xs font-semibold text-surface-900 shrink-0">
                    Delegate Task To:
                  </label>
                  <select
                    id={`assign-dept-${item.work_id}`}
                    value={currentSelect}
                    onChange={(e) => setSelectedDepts((prev) => ({ ...prev, [item.work_id]: e.target.value }))}
                    disabled={item.status === "Resolved" || isAssigning || !!assigned}
                    className="w-full sm:w-72 px-3 py-2 rounded-lg border border-surface-200 bg-white text-xs text-surface-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 shadow-2xs"
                  >
                    {AGENCIES.map((agency) => (
                      <option key={agency} value={agency}>
                        {agency}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleAssign(item)}
                  disabled={item.status === "Resolved" || isAssigning || !!assigned}
                  className={clsx(
                    "px-5 py-2.5 rounded-xl font-display font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm shrink-0",
                    item.status === "Resolved"
                      ? "bg-surface-100 text-surface-400 border border-surface-200 cursor-not-allowed"
                      : assigned
                      ? "bg-purple-50 text-purple-700 border border-purple-200 cursor-default"
                      : "bg-purple-600 text-white hover:bg-purple-700 active:scale-95 shadow-sm"
                  )}
                >
                  {isAssigning ? (
                    <span>Assigning...</span>
                  ) : assigned ? (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Assigned to Agency</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Assign & Notify Department</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
