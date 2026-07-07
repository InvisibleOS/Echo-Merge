"use client";

import { useState } from "react";
import { ActionCase } from "@/lib/types";
import { Clock, FileCheck2, Send, Building2 } from "lucide-react";
import clsx from "clsx";

const ASSIGNMENT_DEPARTMENTS = [
  { id: "dept-safety", label: "Safety" },
  { id: "dept-pwd", label: "PWD" },
  { id: "dept-water", label: "Water Board" },
  { id: "dept-electricity", label: "Power" },
  { id: "dept-solid-waste", label: "SWM" },
];

interface Props {
  cases: ActionCase[];
  updatingCaseId?: string | null;
  onUpdateStatus: (caseId: string, status: string, departmentId?: string) => void | Promise<void>;
}

export default function CaseQueue({ cases, updatingCaseId, onUpdateStatus }: Props) {
  return (
    <section className="rounded-2xl border border-surface-200 bg-white p-4 sm:p-5 shadow-sm min-h-[360px]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display font-bold text-surface-900">Action Queue</h2>
          <p className="text-xs text-surface-500 font-medium">Department-routed cases with SLA pressure</p>
        </div>
        <span className="text-xs text-surface-500 font-bold bg-surface-100 px-2 py-0.5 rounded border border-surface-200">
          {cases.length} cases
        </span>
      </div>

      <div className="space-y-3.5 max-h-[520px] overflow-y-auto pr-1">
        {cases.length === 0 ? (
          <div className="text-center py-12 text-xs text-surface-450 font-medium">
            No active cases in queue
          </div>
        ) : (
          cases.slice(0, 12).map((item) => (
            <CaseQueueItem
              key={item.case_id}
              item={item}
              isUpdating={updatingCaseId === item.case_id}
              onUpdateStatus={onUpdateStatus}
            />
          ))
        )}
      </div>
    </section>
  );
}

function CaseQueueItem({
  item,
  isUpdating,
  onUpdateStatus,
}: {
  item: ActionCase;
  isUpdating: boolean;
  onUpdateStatus: (caseId: string, status: string, departmentId?: string) => void | Promise<void>;
}) {
  const [isChoosingDepartment, setIsChoosingDepartment] = useState(false);
  const isAssigned = item.status === "Assigned";
  const isResolved = item.status === "Resolved";

  return (
    <article
      data-testid={`case-card-${item.case_id}`}
      className="rounded-xl bg-white p-4 border border-surface-200 shadow-2xs hover:border-civic-500/50 hover:shadow-xs transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold uppercase text-civic-600 bg-civic-50 px-1.5 py-0.5 rounded border border-civic-200">
              {item.case_id}
            </span>
            <span
              className={clsx(
                "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shadow-2xs",
                item.priority_band === "Critical"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : item.priority_band === "High"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-surface-100 text-surface-700 border-surface-200"
              )}
            >
              {item.priority_band}
            </span>
            <span className="text-[10px] font-bold uppercase text-surface-500">
              {item.status}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-bold text-surface-900 leading-snug line-clamp-2">
            {item.title}
          </h3>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-display font-black text-surface-900">
            {item.priority_score.toFixed(0)}
          </div>
          <div className="text-[10px] uppercase font-bold text-surface-400 tracking-wider">score</div>
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-surface-50 p-2 border border-surface-200/50">
          <span className="block text-surface-500 uppercase text-[9px] font-bold tracking-wider">Owner</span>
          <span className="font-semibold text-surface-800 flex items-center gap-1 mt-0.5">
            <Building2 size={12} className="text-civic-600" />
            {item.department.short_name}
          </span>
        </div>
        <div className="rounded-lg bg-surface-50 p-2 border border-surface-200/50">
          <span className="block text-surface-500 uppercase text-[9px] font-bold tracking-wider">SLA</span>
          <span className="font-semibold text-surface-800 inline-flex items-center gap-1 mt-0.5">
            <Clock size={12} className="text-amber-600 animate-pulse" /> {item.sla_status}
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs text-surface-700 leading-relaxed line-clamp-2 font-medium">
        {item.resolution_brief.first_action}
      </p>

      <div className="mt-4 flex gap-2 pt-3 border-t border-surface-100">
        <button
          data-testid={`assign-case-${item.case_id}`}
          type="button"
          disabled={isUpdating || isAssigned || isResolved}
          onClick={() => setIsChoosingDepartment(true)}
          className={clsx(
            "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:scale-100 disabled:opacity-60 disabled:cursor-not-allowed",
            isAssigned
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-civic-600 text-white hover:bg-civic-700"
          )}
        >
          <Send size={12} /> {isUpdating ? "Assigning..." : isAssigned ? "Assigned" : "Assign Agency"}
        </button>
        <button
          type="button"
          disabled={isUpdating || isResolved}
          onClick={() => onUpdateStatus(item.case_id, "Resolved")}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs font-bold text-surface-700 hover:text-surface-900 hover:bg-surface-50 hover:border-surface-300 transition-all shadow-2xs active:scale-95 disabled:scale-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FileCheck2 size={12} /> {isUpdating ? "Updating..." : isResolved ? "Resolved" : "Resolve Case"}
        </button>
      </div>

      {isChoosingDepartment && !isAssigned && !isResolved && (
        <div className="mt-3.5 rounded-xl border border-civic-200 bg-civic-50/50 p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-civic-900">Assign to municipal department:</p>
            <button
              type="button"
              onClick={() => setIsChoosingDepartment(false)}
              className="text-xs font-bold text-surface-500 hover:text-surface-700"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {ASSIGNMENT_DEPARTMENTS.map((department) => (
              <button
                data-testid={`assign-${item.case_id}-${department.id}`}
                key={department.id}
                type="button"
                disabled={isUpdating}
                onClick={() => {
                  setIsChoosingDepartment(false);
                  onUpdateStatus(item.case_id, "Assigned", department.id);
                }}
                className="rounded-lg border border-surface-200 bg-white px-2.5 py-1.5 text-xs font-bold text-surface-750 transition-colors hover:border-civic-500 hover:bg-civic-50 hover:text-civic-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {department.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
