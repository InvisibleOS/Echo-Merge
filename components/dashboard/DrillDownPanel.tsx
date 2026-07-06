"use client";

import { useState } from "react";
import { PriorityItem } from "@/lib/types";
import { resolvePriority } from "@/lib/api";
import { CategoryBadge } from "@/components/ui/Badge";
import {
  X,
  Users,
  MapPin,
  CheckCircle2,
  Building2,
  Clock,
  WalletCards,
  Wand2,
} from "lucide-react";
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
      onResolve(item.work_id);
    } finally {
      setIsResolving(false);
    }
  }

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
        <span
          className={clsx(
            "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full",
            isResolved
              ? "bg-signal-green/15 text-signal-green"
              : "bg-signal-amber/15 text-amber-700"
          )}
        >
          {isResolved ? (
            <>
              <CheckCircle2 size={12} /> Resolved
            </>
          ) : (
            "Open"
          )}
        </span>
        {item.department && (
          <span className="inline-flex items-center gap-1 text-xs text-civic-700 bg-civic-50 px-2 py-0.5 rounded-full font-semibold">
            <Building2 size={13} /> {item.department.short_name}
          </span>
        )}
        {item.sla_status && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-semibold">
            <Clock size={13} /> {item.sla_status}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-ink-800/60">
          <Users size={13} /> {item.demand_count} citizens
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-ink-800/60">
          <MapPin size={13} />
          {item.hotspot_geo.lat.toFixed(4)}, {item.hotspot_geo.lng.toFixed(4)}
        </span>
      </div>

      {!isResolved && (
        <button
          type="button"
          onClick={handleResolve}
          disabled={isResolving}
          className={clsx(
            "mt-5 w-full flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-display font-semibold transition-all",
            "bg-signal-green text-white hover:bg-green-700",
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
          id="btn-mark-resolved"
        >
          <CheckCircle2 size={16} />
          {isResolving ? "Updating..." : "Mark as Resolved"}
        </button>
      )}

      {item.resolution_brief && (
        <div className="mt-5 p-4 rounded-md bg-civic-50 border border-civic-100">
          <h3 className="text-xs font-semibold text-civic-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Wand2 size={14} /> Resolution Brief
          </h3>
          <p className="text-sm font-semibold text-ink-900 leading-snug">
            {item.resolution_brief.summary}
          </p>
          <p className="text-xs text-ink-800/70 mt-2 leading-relaxed">
            {item.resolution_brief.why_now}
          </p>
          <div className="mt-3 rounded bg-white/80 border border-civic-100 p-3">
            <span className="block text-[10px] uppercase font-bold text-ink-800/45 mb-1">
              First action
            </span>
            <p className="text-sm text-ink-900 leading-relaxed">
              {item.resolution_brief.first_action}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-xs font-semibold text-ink-800/60 uppercase tracking-wide mb-3 flex items-center justify-between">
          <span>AI Scoring Breakdown</span>
          <span className="text-civic-600 font-bold bg-civic-50 px-2 py-0.5 rounded-full">
            {(item.scoring_breakdown?.final_score || item.demand_score).toFixed(1)} / 100
          </span>
        </h3>

        <div className="bg-ink-900/5 rounded-lg p-1">
          <div className="grid grid-cols-2 gap-1 mb-1">
            <ScoreCell
              label="Citizen Demand"
              value={item.scoring_breakdown?.base_demand.toFixed(1) || item.demand_score.toFixed(1)}
              tone="text-civic-500"
              suffix="Base"
            />
            <ScoreCell
              label="Urgency"
              value={`+${(item.scoring_breakdown?.urgency_multiplier || 0.12).toFixed(2)}x`}
              tone="text-red-500"
              suffix="Boost"
            />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <ScoreCell
              label="Census Equity"
              value={`+${(item.scoring_breakdown?.equity_multiplier || 0.05).toFixed(2)}x`}
              tone="text-purple-500"
              suffix="Boost"
            />
            <ScoreCell
              label="UDISE / Health Gap"
              value={`+${(item.scoring_breakdown?.data_gap_multiplier || 0.05).toFixed(2)}x`}
              tone="text-signal-amber"
              suffix="Boost"
            />
          </div>
        </div>

        <p className="text-xs text-ink-800/60 mt-3 italic px-1 leading-relaxed">
          {item.explanation}
        </p>
      </div>

      {item.budget_recommendation && (
        <div className="mt-5 rounded-md border border-ink-900/10 p-3">
          <span className="text-[10px] uppercase font-bold text-ink-800/45 flex items-center gap-1">
            <WalletCards size={12} /> Budget fit
          </span>
          <p className="text-sm font-semibold text-ink-900 mt-2">
            {item.budget_recommendation.recommended_budget_tier} priority
          </p>
          <p className="text-xs text-ink-800/60 mt-1">
            {item.budget_recommendation.recommendation || item.budget_recommendation.rationale}
          </p>
        </div>
      )}

      {item.solution_plan && (
        <div className="mt-5 p-4 rounded-md bg-signal-amber/10 border border-signal-amber/30">
          <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-3">
            Solution Plan
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Info label="Primary Agency" value={item.solution_plan.primary_department} />
            <Info label="Timeline" value={item.solution_plan.remediation_timeline} />
            <div className="col-span-2">
              <Info label="Budget Tier" value={item.solution_plan.estimated_budget_tier} />
            </div>
          </div>
          <span className="block text-[10px] uppercase text-ink-800/60 font-semibold mb-2">
            Recommended Action Steps
          </span>
          <ul className="space-y-2 mb-4">
            {item.solution_plan.action_steps.map((step, idx) => (
              <li key={idx} className="text-sm text-ink-900 flex items-start gap-2">
                <span className="text-signal-amber font-bold mt-0.5">•</span>
                <span className="leading-snug">{step}</span>
              </li>
            ))}
          </ul>
          <div className="pt-3 border-t border-amber-900/10">
            <span className="block text-[10px] uppercase text-amber-800/60 font-semibold mb-1">
              Strategic Rationale
            </span>
            <p className="text-xs text-amber-900/80 italic leading-relaxed">
              &ldquo;{item.solution_plan.strategic_rationale}&rdquo;
            </p>
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

            {(ev.geo || ev.canonical_location) && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-civic-600 font-medium bg-civic-50 px-2 py-1 rounded-md w-fit">
                <MapPin size={12} />
                {ev.canonical_location ||
                  (ev.geo && ev.geo.lat
                    ? `${ev.geo.lat.toFixed(4)}, ${ev.geo.lng.toFixed(4)}`
                    : "Location Attached")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreCell({
  label,
  value,
  tone,
  suffix,
}: {
  label: string;
  value: string;
  tone: string;
  suffix: string;
}) {
  return (
    <div className="bg-white rounded p-3 shadow-sm border border-ink-900/5">
      <span className={`text-[10px] uppercase font-bold mb-1 block ${tone}`}>
        {label}
      </span>
      <div className="flex items-end justify-between">
        <span className="text-xl font-display font-bold text-ink-900 leading-none">
          {value}
        </span>
        <span className="text-xs text-ink-800/60 font-medium">{suffix}</span>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[10px] uppercase text-ink-800/60 font-semibold mb-1">
        {label}
      </span>
      <span className="text-sm font-medium text-ink-900">{value}</span>
    </div>
  );
}
