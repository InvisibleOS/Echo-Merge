"use client";

import { useState } from "react";
import { ActionCase } from "@/lib/types";
import { Clock, FileCheck2, Send } from "lucide-react";
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
    <section className="rounded-lg border border-white/10 bg-ink-900/70 p-4 min-h-[360px]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display font-bold text-white">Action Queue</h2>
          <p className="text-xs text-white/45">Department-routed cases with SLA pressure</p>
        </div>
        <span className="text-xs text-white/45">{cases.length} cases</span>
      </div>

      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {cases.slice(0, 12).map((item) => (
          <CaseQueueItem
            key={item.case_id}
            item={item}
            isUpdating={updatingCaseId === item.case_id}
            onUpdateStatus={onUpdateStatus}
          />
        ))}
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
      className="rounded-md bg-white p-3 border border-ink-900/10"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase text-civic-600">{item.case_id}</span>
            <span
              className={clsx(
                "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                item.priority_band === "Critical"
                  ? "bg-red-100 text-red-700"
                  : item.priority_band === "High"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-ink-900/5 text-ink-700"
              )}
            >
              {item.priority_band}
            </span>
            <span className="text-[10px] font-semibold uppercase text-ink-800/50">
              {item.status}
            </span>
          </div>
          <h3 className="mt-1 text-sm font-semibold text-ink-900 leading-snug line-clamp-2">
            {item.title}
          </h3>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-display font-bold text-ink-900">
            {item.priority_score.toFixed(0)}
          </div>
          <div className="text-[10px] uppercase text-ink-800/45">score</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded bg-ink-900/[0.03] p-2">
          <span className="block text-ink-800/45 uppercase text-[10px] font-semibold">Owner</span>
          <span className="font-medium text-ink-900">{item.department.short_name}</span>
        </div>
        <div className="rounded bg-ink-900/[0.03] p-2">
          <span className="block text-ink-800/45 uppercase text-[10px] font-semibold">SLA</span>
          <span className="font-medium text-ink-900 inline-flex items-center gap-1">
            <Clock size={12} /> {item.sla_status}
          </span>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-800/65 leading-relaxed line-clamp-2">
        {item.resolution_brief.first_action}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          data-testid={`assign-case-${item.case_id}`}
          type="button"
          disabled={isUpdating || isAssigned || isResolved}
          onClick={() => setIsChoosingDepartment(true)}
          className={clsx(
            "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed",
            isAssigned
              ? "bg-emerald-600"
              : "bg-civic-600 hover:bg-civic-700 disabled:bg-ink-400"
          )}
        >
          <Send size={12} /> {isUpdating ? "Assigning" : isAssigned ? "Assigned" : "Assign"}
        </button>
        <button
          type="button"
          disabled={isUpdating || isResolved}
          onClick={() => onUpdateStatus(item.case_id, "Resolved")}
          className="inline-flex items-center gap-1 rounded-md border border-ink-900/10 px-3 py-1.5 text-xs font-semibold text-ink-800 transition-colors disabled:cursor-not-allowed disabled:text-ink-800/40"
        >
          <FileCheck2 size={12} /> {isUpdating ? "Updating" : isResolved ? "Resolved" : "Resolve"}
        </button>
      </div>

      {isChoosingDepartment && !isAssigned && !isResolved && (
        <div className="mt-3 rounded-md border border-civic-100 bg-civic-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-ink-900">Assign to which department?</p>
            <button
              type="button"
              onClick={() => setIsChoosingDepartment(false)}
              className="text-xs font-semibold text-ink-800/55 hover:text-ink-900"
            >
              Cancel
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
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
                className="rounded-md border border-civic-200 bg-white px-2 py-1.5 text-xs font-semibold text-civic-700 transition-colors hover:border-civic-500 hover:bg-civic-100 disabled:cursor-not-allowed disabled:opacity-60"
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
