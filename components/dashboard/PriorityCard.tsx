"use client";

import { PriorityItem } from "@/lib/types";
import { CategoryBadge } from "@/components/ui/Badge";
import { Users, ChevronRight, Activity, Building2, Clock } from "lucide-react";
import clsx from "clsx";

interface Props {
  item: PriorityItem;
  isSelected: boolean;
  onSelect: () => void;
}

export default function PriorityCard({ item, isSelected, onSelect }: Props) {
  // Safe extraction of scoring breakdown with defaults
  const breakdown = item.scoring_breakdown || {
    base_demand: item.demand_score,
    urgency_multiplier: 0.12,
    equity_multiplier: 0.05,
    validation_multiplier: 0.05,
    feasibility_multiplier: 0.05,
    final_score: item.demand_score,
  };

  const validationMult = breakdown.validation_multiplier ?? (breakdown.data_gap_multiplier || 0.05);

  // Calculate percentages for the progress bar (approximate visual weights)
  const totalMultiplier =
    1.0 +
    breakdown.urgency_multiplier +
    breakdown.equity_multiplier +
    validationMult +
    breakdown.feasibility_multiplier;
    
  const basePct = (1.0 / totalMultiplier) * 100;
  const equityPct = (breakdown.equity_multiplier / totalMultiplier) * 100;
  const validationPct = (validationMult / totalMultiplier) * 100;
  const urgencyPct = (breakdown.urgency_multiplier / totalMultiplier) * 100;

  return (
    <button
      onClick={onSelect}
      className={clsx(
        "w-full text-left rounded-xl border p-4 transition-all duration-300 relative overflow-hidden group",
        isSelected
          ? "border-civic-500 bg-gradient-to-br from-white to-civic-50/50 shadow-md ring-1 ring-civic-500/20"
          : "border-ink-900/10 bg-white hover:border-civic-400/50 hover:shadow-sm"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Rank Badge */}
        <div className="flex flex-col items-center justify-center bg-ink-900/5 rounded-lg w-10 h-10 shrink-0">
          <span className="text-[10px] uppercase font-bold text-ink-800/60 leading-none">Rank</span>
          <span className="font-display font-900 text-lg text-civic-600 leading-none mt-0.5">
            {item.rank}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-ink-900 leading-snug group-hover:text-civic-700 transition-colors">
            {item.title}
          </h3>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <CategoryBadge category={item.category} />
            <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-800/70 bg-ink-900/5 px-2 py-0.5 rounded-full">
              <Users size={12} /> {item.demand_count}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-signal-amber bg-signal-amber/10 px-2 py-0.5 rounded-full">
              <Activity size={12} /> {breakdown.final_score.toFixed(1)} AI Score
            </span>
            {item.department && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-civic-700 bg-civic-50 px-2 py-0.5 rounded-full">
                <Building2 size={12} /> {item.department.short_name}
              </span>
            )}
            {item.sla_status && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-800/70 bg-ink-900/5 px-2 py-0.5 rounded-full">
                <Clock size={12} /> {item.sla_status}
              </span>
            )}
          </div>
          
          {/* Micro-visualization of AI Scoring Math */}
          <div className="mt-3">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[10px] font-semibold text-ink-800/50 uppercase tracking-wide">AI Scoring Weights</span>
            </div>
            <div className="h-1.5 w-full bg-ink-900/5 rounded-full flex overflow-hidden">
              <div 
                style={{ width: `${basePct}%` }} 
                className="bg-civic-400 h-full"
                title={`Citizen Demand: ${basePct.toFixed(0)}%`}
              />
              <div 
                style={{ width: `${equityPct}%` }} 
                className="bg-purple-400 h-full border-l border-white/50"
                title={`Census Equity Boost: ${equityPct.toFixed(0)}%`}
              />
              <div 
                style={{ width: `${validationPct}%` }} 
                className="bg-signal-amber h-full border-l border-white/50"
                title={`AI Validation Boost: ${validationPct.toFixed(0)}%`}
              />
               <div 
                style={{ width: `${urgencyPct}%` }} 
                className="bg-red-400 h-full border-l border-white/50"
                title={`Urgency: ${urgencyPct.toFixed(0)}%`}
              />
            </div>
          </div>
        </div>

        <ChevronRight
          size={20}
          className={clsx(
            "text-ink-800/30 shrink-0 mt-2 transition-transform duration-300",
            isSelected && "rotate-90 text-civic-500"
          )}
        />
      </div>
    </button>
  );
}
