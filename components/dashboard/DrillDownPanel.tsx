"use client";

import { PriorityItem } from "@/lib/types";
import { CategoryBadge } from "@/components/ui/Badge";
import { X, Users, MapPin } from "lucide-react";

interface Props {
  item: PriorityItem;
  onClose: () => void;
}

export default function DrillDownPanel({ item, onClose }: Props) {
  return (
    <div className="bg-white border border-ink-900/10 rounded-lg p-6 h-full overflow-y-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-civic-600 uppercase tracking-wide">
            Rank #{item.rank}
          </span>
          <h2 className="font-display font-bold text-xl text-ink-900 mt-1">
            {item.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-ink-800/40 hover:text-ink-900 shrink-0"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <CategoryBadge category={item.category} />
        <span className="inline-flex items-center gap-1 text-xs text-ink-800/60">
          <Users size={13} /> {item.demand_count} citizens
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-ink-800/60">
          <MapPin size={13} />
          {item.hotspot_geo.lat.toFixed(4)}, {item.hotspot_geo.lng.toFixed(4)}
        </span>
      </div>

      <div className="mt-6">
        <h3 className="text-xs font-semibold text-ink-800/60 uppercase tracking-wide mb-3 flex items-center justify-between">
          <span>AI Scoring Breakdown</span>
          <span className="text-civic-600 font-bold bg-civic-50 px-2 py-0.5 rounded-full">
             {(item.scoring_breakdown?.final_score || item.demand_score).toFixed(1)} / 100
          </span>
        </h3>
        
        <div className="bg-ink-900/5 rounded-lg p-1">
          <div className="grid grid-cols-2 gap-1 mb-1">
            <div className="bg-white rounded p-3 shadow-sm border border-ink-900/5">
              <span className="text-[10px] uppercase font-bold text-civic-500 mb-1 block">Citizen Demand</span>
              <div className="flex items-end justify-between">
                <span className="text-xl font-display font-bold text-ink-900 leading-none">
                  {item.scoring_breakdown?.base_demand.toFixed(1) || item.demand_score.toFixed(1)}
                </span>
                <span className="text-xs text-ink-800/60 font-medium">Base</span>
              </div>
            </div>
            
            <div className="bg-white rounded p-3 shadow-sm border border-ink-900/5">
              <span className="text-[10px] uppercase font-bold text-red-500 mb-1 block">Urgency</span>
              <div className="flex items-end justify-between">
                <span className="text-xl font-display font-bold text-ink-900 leading-none">
                  +{(item.scoring_breakdown?.urgency_multiplier || 0.12).toFixed(2)}x
                </span>
                <span className="text-xs text-ink-800/60 font-medium">Boost</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-1">
            <div className="bg-white rounded p-3 shadow-sm border border-ink-900/5">
              <span className="text-[10px] uppercase font-bold text-purple-500 mb-1 block">Census Equity</span>
              <div className="flex items-end justify-between">
                <span className="text-xl font-display font-bold text-ink-900 leading-none">
                  +{(item.scoring_breakdown?.equity_multiplier || 0.05).toFixed(2)}x
                </span>
                <span className="text-xs text-ink-800/60 font-medium">Boost</span>
              </div>
            </div>
            
            <div className="bg-white rounded p-3 shadow-sm border border-ink-900/5">
              <span className="text-[10px] uppercase font-bold text-signal-amber mb-1 block">UDISE / Health Gap</span>
              <div className="flex items-end justify-between">
                <span className="text-xl font-display font-bold text-ink-900 leading-none">
                  +{(item.scoring_breakdown?.data_gap_multiplier || 0.05).toFixed(2)}x
                </span>
                <span className="text-xs text-ink-800/60 font-medium">Boost</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-ink-800/60 mt-3 italic px-1 leading-relaxed">
          {item.explanation}
        </p>
      </div>

      {item.solution_plan && (
        <div className="mt-5 p-4 rounded-md bg-signal-amber/10 border border-signal-amber/30">
          <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-3 flex items-center gap-2">
            ✨ AI Solution Plan
          </h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="block text-[10px] uppercase text-ink-800/60 font-semibold mb-1">Primary Agency</span>
              <span className="text-sm font-medium text-ink-900">{item.solution_plan.primary_department}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase text-ink-800/60 font-semibold mb-1">Timeline</span>
              <span className="text-sm font-medium text-ink-900">{item.solution_plan.remediation_timeline}</span>
            </div>
            <div className="col-span-2">
              <span className="block text-[10px] uppercase text-ink-800/60 font-semibold mb-1">Budget Tier</span>
              <span className="text-sm font-medium text-ink-900">{item.solution_plan.estimated_budget_tier}</span>
            </div>
          </div>

          <span className="block text-[10px] uppercase text-ink-800/60 font-semibold mb-2">Recommended Action Steps</span>
          <ul className="space-y-2 mb-4">
            {item.solution_plan.action_steps.map((step, idx) => (
              <li key={idx} className="text-sm text-ink-900 flex items-start gap-2">
                <span className="text-signal-amber font-bold mt-0.5">•</span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ul>
          
          <div className="pt-3 border-t border-amber-900/10">
            <span className="block text-[10px] uppercase text-amber-800/60 font-semibold mb-1">Strategic Rationale</span>
            <p className="text-xs text-amber-900/80 italic leading-relaxed">"{item.solution_plan.strategic_rationale}"</p>
          </div>
        </div>
      )}

      <h3 className="text-xs font-semibold text-ink-800/60 uppercase tracking-wide mt-6 mb-3">
        Supporting evidence ({item.supporting_evidence.length})
      </h3>

      <div className="space-y-3">
        {item.supporting_evidence.map((ev) => (
          <div
            key={ev.submission_id}
            className="border border-ink-900/10 rounded-md p-4"
          >
            <span className="text-[11px] font-semibold text-ink-800/40 uppercase">
              {ev.language}
            </span>
            <p className="text-sm text-ink-900 mt-1">{ev.raw_text}</p>

            {ev.language.toLowerCase() !== "english" && (
              <p className="text-sm text-ink-800/60 mt-2 pt-2 border-t border-ink-900/5 italic">
                &ldquo;{ev.normalized_text_en}&rdquo;
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
