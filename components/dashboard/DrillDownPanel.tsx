"use client";

import { useState } from "react";
import { PriorityItem } from "@/lib/types";
import { resolvePriority } from "@/lib/api";
import { CategoryBadge } from "@/components/ui/Badge";
import { X, Users, MapPin, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

interface Props {
  item: PriorityItem;
  onClose: () => void;
  onResolve: (workId: string) => void;
}

export default function DrillDownPanel({ item, onClose, onResolve }: Props) {
  const [isResolving, setIsResolving] = useState(false);
  const isResolved = item.status === "Resolved";

  async function handleResolve() {
    if (isResolving || isResolved) return;
    setIsResolving(true);
    try {
      await resolvePriority(item.work_id);
      onResolve(item.work_id);
    } catch {
      // Silently fail — the button stays enabled so the user can retry
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <div className="bg-white border border-surface-200 rounded-2xl p-6 h-full overflow-y-auto shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-civic-600 uppercase tracking-wide">
            Rank #{item.rank}
          </span>
          <h2 className="font-display font-bold text-xl text-surface-900 mt-1">
            {item.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-surface-400 hover:text-surface-900 shrink-0 p-1 rounded-lg hover:bg-surface-100 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <CategoryBadge category={item.category} />

        {/* Status badge */}
        <span
          className={clsx(
            "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full",
            isResolved
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : item.status === "Assigned" || item.assigned_department
              ? "bg-purple-50 text-purple-700 border border-purple-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          )}
        >
          {isResolved ? (
            <>
              <CheckCircle2 size={12} /> Resolved
            </>
          ) : item.status === "Assigned" || item.assigned_department ? (
            <>
              🏢 Assigned: {item.assigned_department || "Agency"}
            </>
          ) : (
            "Open"
          )}
        </span>

        <span className="inline-flex items-center gap-1 text-xs font-medium text-surface-700 bg-surface-100 px-2.5 py-0.5 rounded-full border border-surface-200">
          <Users size={13} /> {item.demand_count} citizens
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-surface-700 bg-surface-100 px-2.5 py-0.5 rounded-full border border-surface-200">
          <MapPin size={13} />
          {item.hotspot_geo.lat.toFixed(4)}, {item.hotspot_geo.lng.toFixed(4)}
        </span>
      </div>

      {/* ── Mark as Resolved button ── */}
      {!isResolved && (
        <button
          type="button"
          onClick={handleResolve}
          disabled={isResolving}
          className={clsx(
            "mt-5 w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-display font-semibold transition-all shadow-sm",
            "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
          id="btn-mark-resolved"
        >
          <CheckCircle2 size={16} />
          {isResolving ? "Updating…" : "Mark as Resolved"}
        </button>
      )}

      {isResolved && (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} />
          This issue has been resolved
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3 flex items-center justify-between">
          <span>AI Scoring Breakdown</span>
          <span className="text-civic-600 font-bold bg-civic-50 px-2.5 py-0.5 rounded-full border border-civic-200">
             {(item.scoring_breakdown?.final_score || item.demand_score).toFixed(1)} / 100
          </span>
        </h3>
        
        <div className="bg-surface-100 rounded-xl p-1.5 border border-surface-200">
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <div className="bg-white rounded-lg p-3 shadow-2xs border border-surface-200">
              <span className="text-[10px] uppercase font-bold text-civic-600 mb-1 block">Citizen Demand</span>
              <div className="flex items-end justify-between">
                <span className="text-xl font-display font-bold text-surface-900 leading-none">
                  {item.scoring_breakdown?.base_demand.toFixed(1) || item.demand_score.toFixed(1)}
                </span>
                <span className="text-xs text-surface-500 font-medium">Base</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-3 shadow-2xs border border-surface-200">
              <span className="text-[10px] uppercase font-bold text-red-600 mb-1 block">Urgency</span>
              <div className="flex items-end justify-between">
                <span className="text-xl font-display font-bold text-surface-900 leading-none">
                  +{(item.scoring_breakdown?.urgency_multiplier || 0.12).toFixed(2)}x
                </span>
                <span className="text-xs text-surface-500 font-medium">Boost</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-white rounded-lg p-3 shadow-2xs border border-surface-200">
              <span className="text-[10px] uppercase font-bold text-purple-600 mb-1 block">Census Equity</span>
              <div className="flex items-end justify-between">
                <span className="text-xl font-display font-bold text-surface-900 leading-none">
                  +{(item.scoring_breakdown?.equity_multiplier || 0.05).toFixed(2)}x
                </span>
                <span className="text-xs text-surface-500 font-medium">Boost</span>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-3 shadow-2xs border border-surface-200">
              <span className="text-[10px] uppercase font-bold text-amber-600 mb-1 block">UDISE / Health Gap</span>
              <div className="flex items-end justify-between">
                <span className="text-xl font-display font-bold text-surface-900 leading-none">
                  +{(item.scoring_breakdown?.data_gap_multiplier || 0.05).toFixed(2)}x
                </span>
                <span className="text-xs text-surface-500 font-medium">Boost</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-surface-700 mt-3.5 italic px-1 leading-relaxed font-medium">
          {item.explanation}
        </p>
      </div>

      {item.solution_plan && (
        <div className="mt-5 p-4 rounded-xl bg-amber-50/70 border border-amber-200 shadow-2xs">
          <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-3 flex items-center gap-2">
            ✨ AI Solution Plan
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="block text-[10px] uppercase text-surface-500 font-semibold mb-1">Primary Agency</span>
              <span className="text-sm font-medium text-surface-900">{item.solution_plan.primary_department}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-surface-500 font-semibold mb-1">Timeline</span>
              <span className="text-sm font-medium text-surface-900">{item.solution_plan.remediation_timeline}</span>
            </div>
            <div className="col-span-2">
              <span className="block text-[10px] uppercase text-surface-500 font-semibold mb-1">Budget Tier</span>
              <span className="text-sm font-medium text-surface-900">{item.solution_plan.estimated_budget_tier}</span>
            </div>
          </div>

          <span className="block text-[10px] uppercase text-surface-500 font-semibold mb-2">Recommended Action Steps</span>
          <ul className="space-y-2 mb-4">
            {item.solution_plan.action_steps.map((step, idx) => (
              <li key={idx} className="text-sm text-surface-900 flex items-start gap-2 font-medium">
                <span className="text-amber-600 font-bold mt-0.5">•</span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ul>
          
          <div className="pt-3 border-t border-amber-200/80">
            <span className="block text-[10px] uppercase text-amber-800/80 font-semibold mb-1">Strategic Rationale</span>
            <p className="text-xs text-amber-950 italic leading-relaxed">&ldquo;{item.solution_plan.strategic_rationale}&rdquo;</p>
          </div>
        </div>
      )}

      <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mt-6 mb-3">
        Supporting evidence ({item.supporting_evidence.length})
      </h3>

      <div className="space-y-3">
        {item.supporting_evidence.map((ev) => (
          <div
            key={ev.submission_id}
            className="border border-surface-200 rounded-xl p-4 bg-surface-50/50 shadow-2xs"
          >
            <span className="text-[11px] font-semibold text-surface-400 uppercase">
              {ev.language}
            </span>
            <p className="text-sm text-surface-900 mt-1 font-medium">{ev.raw_text}</p>

            {ev.language.toLowerCase() !== "english" && (
              <p className="text-sm text-surface-700 mt-2 pt-2 border-t border-surface-200 italic">
                &ldquo;{ev.normalized_text_en}&rdquo;
              </p>
            )}
            
            {(ev.geo || ev.canonical_location) && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-civic-700 font-medium bg-civic-50 px-2.5 py-1 rounded-lg border border-civic-200 w-fit">
                <MapPin size={12} />
                {ev.canonical_location || (ev.geo && ev.geo.lat ? `${ev.geo.lat.toFixed(4)}, ${ev.geo.lng.toFixed(4)}` : "Location Attached")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
