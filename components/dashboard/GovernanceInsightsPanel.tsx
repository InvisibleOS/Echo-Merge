"use client";

import { GovernanceInsights } from "@/lib/types";
import { BarChart3, Megaphone, WalletCards } from "lucide-react";

interface Props {
  insights: GovernanceInsights | null;
}

export default function GovernanceInsightsPanel({ insights }: Props) {
  return (
    <section className="rounded-2xl border border-surface-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <BarChart3 size={18} className="text-amber-600" />
        <div>
          <h2 className="font-display font-bold text-surface-900">Weekly Governance Brief</h2>
          <p className="text-xs text-surface-500 font-medium">AI-generated operating notes</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {(insights?.weekly_brief || ["Loading governance signals..."]).map((line, index) => (
          <p key={index} className="text-sm text-surface-850 leading-relaxed bg-surface-50 rounded-xl p-3.5 border border-surface-200/40 font-medium">
            {line}
          </p>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-3xs">
          <div className="flex items-center gap-2 mb-3 text-surface-900 font-bold text-sm">
            <Megaphone size={15} className="text-civic-600" /> Emerging Issues
          </div>
          <div className="space-y-3">
            {insights?.emerging_issues.slice(0, 3).map((issue) => (
              <div key={issue.title} className="border-t border-surface-200/70 pt-2.5">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs font-bold text-surface-900 leading-snug">{issue.title}</span>
                  <span className="text-[10px] uppercase text-civic-700 bg-civic-50 px-2 py-0.5 rounded border border-civic-200 font-bold tracking-wide shrink-0">
                    {issue.severity}
                  </span>
                </div>
                <p className="text-xs text-surface-600 mt-1.5 leading-relaxed font-medium line-clamp-2">{issue.evidence}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-3xs">
          <div className="flex items-center gap-2 mb-3 text-surface-900 font-bold text-sm">
            <WalletCards size={15} className="text-amber-600" /> Budget Recommendations
          </div>
          <div className="space-y-3">
            {insights?.budget_recommendations.slice(0, 3).map((budget) => (
              <div key={budget.category} className="border-t border-surface-200/70 pt-2.5">
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs font-bold text-surface-900 leading-snug">{budget.category}</span>
                  <span className="text-[10px] uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold tracking-wide shrink-0">
                    {budget.recommended_budget_tier}
                  </span>
                </div>
                <p className="text-xs text-surface-600 mt-1.5 leading-relaxed font-medium line-clamp-2">{budget.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
