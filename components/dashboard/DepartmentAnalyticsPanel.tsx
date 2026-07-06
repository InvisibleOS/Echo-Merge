"use client";

import { DepartmentAnalytics } from "@/lib/types";

interface Props {
  departments: DepartmentAnalytics[];
}

export default function DepartmentAnalyticsPanel({ departments }: Props) {
  return (
    <section className="rounded-lg border border-white/10 bg-ink-900/70 p-4">
      <div className="mb-4">
        <h2 className="font-display font-bold text-white">Department Workload</h2>
        <p className="text-xs text-white/45">SLA health and coordination pressure</p>
      </div>

      <div className="space-y-3">
        {departments.map((dept) => (
          <div key={dept.id} className="rounded-md bg-white/[0.06] border border-white/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{dept.short_name}</h3>
                <p className="text-xs text-white/45">{dept.officer}</p>
              </div>
              <span className="text-xs font-bold text-white">{dept.sla_compliance}% SLA</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-civic-400"
                style={{ width: `${Math.max(4, Math.min(100, dept.sla_compliance))}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-white/50">
              <span>{dept.active_cases} active</span>
              <span>{dept.sla_breaches} breaches</span>
            </div>
            <p className="mt-2 text-xs text-white/58 leading-relaxed">{dept.recommended_action}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

