"use client";

import { DepartmentAnalytics } from "@/lib/types";

interface Props {
  departments: DepartmentAnalytics[];
}

export default function DepartmentAnalyticsPanel({ departments }: Props) {
  return (
    <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="font-display font-bold text-surface-900">Department Workload</h2>
        <p className="text-xs text-surface-500 font-medium font-sans">SLA health and coordination pressure</p>
      </div>

      <div className="space-y-4">
        {departments.map((dept) => (
          <div key={dept.id} className="rounded-xl bg-surface-50 border border-surface-200/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-surface-900">{dept.short_name}</h3>
                <p className="text-xs text-surface-500 font-medium mt-0.5">{dept.officer}</p>
              </div>
              <span className="text-xs font-bold text-civic-700 bg-civic-50 px-2 py-0.5 rounded border border-civic-200">
                {dept.sla_compliance}% SLA
              </span>
            </div>
            <div className="mt-3.5 h-2 rounded-full bg-surface-200/70 overflow-hidden">
              <div
                className="h-full bg-civic-500 rounded-full"
                style={{ width: `${Math.max(4, Math.min(100, dept.sla_compliance))}%` }}
              />
            </div>
            <div className="mt-2.5 flex justify-between text-[11px] text-surface-500 font-bold">
              <span>{dept.active_cases} active cases</span>
              <span>{dept.sla_breaches} breaches</span>
            </div>
            <p className="mt-2.5 text-xs text-surface-700 leading-relaxed font-semibold bg-white p-2.5 rounded-lg border border-surface-200/50 shadow-3xs">
              {dept.recommended_action}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
