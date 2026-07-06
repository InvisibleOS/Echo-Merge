"use client";

import { GovernanceInsights } from "@/lib/types";
import { BarChart3, Megaphone, WalletCards } from "lucide-react";

interface Props {
  insights: GovernanceInsights | null;
}

export default function GovernanceInsightsPanel({ insights }: Props) {
  return (
    <section className="rounded-lg border border-white/10 bg-ink-900/70 p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={18} className="text-signal-amber" />
        <div>
          <h2 className="font-display font-bold text-white">Weekly Governance Brief</h2>
          <p className="text-xs text-white/45">AI-generated operating notes</p>
        </div>
      </div>

      <div className="space-y-2">
        {(insights?.weekly_brief || ["Loading governance signals..."]).map((line, index) => (
          <p key={index} className="text-sm text-white/72 leading-relaxed bg-white/[0.04] rounded-md p-3">
            {line}
          </p>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-md bg-white p-3">
          <div className="flex items-center gap-2 mb-2 text-ink-900 font-semibold text-sm">
            <Megaphone size={15} /> Emerging Issues
          </div>
          <div className="space-y-2">
            {insights?.emerging_issues.slice(0, 3).map((issue) => (
              <div key={issue.title} className="border-t border-ink-900/5 pt-2">
                <div className="flex justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-900">{issue.title}</span>
                  <span className="text-[10px] uppercase text-civic-600 font-bold">{issue.severity}</span>
                </div>
                <p className="text-xs text-ink-800/60 mt-1 line-clamp-2">{issue.evidence}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md bg-white p-3">
          <div className="flex items-center gap-2 mb-2 text-ink-900 font-semibold text-sm">
            <WalletCards size={15} /> Budget Recommendations
          </div>
          <div className="space-y-2">
            {insights?.budget_recommendations.slice(0, 3).map((budget) => (
              <div key={budget.category} className="border-t border-ink-900/5 pt-2">
                <div className="flex justify-between gap-2">
                  <span className="text-xs font-semibold text-ink-900">{budget.category}</span>
                  <span className="text-[10px] uppercase text-signal-amber font-bold">
                    {budget.recommended_budget_tier}
                  </span>
                </div>
                <p className="text-xs text-ink-800/60 mt-1 line-clamp-2">{budget.rationale}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

