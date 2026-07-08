"use client";

import { PriorityItem } from "@/lib/types";
import { CategoryBadge } from "@/components/ui/Badge";
import { RATING_DIMENSIONS, ratingFor } from "@/lib/rating";
import { Users, ChevronRight, Activity, Building2, Clock } from "lucide-react";
import clsx from "clsx";
import EvidenceAttachments from "./EvidenceAttachments";

interface Props {
  item: PriorityItem;
  isSelected: boolean;
  onSelect: () => void;
}

export default function PriorityCard({ item, isSelected, onSelect }: Props) {
  const rating = ratingFor(item);
  const photoImages = (item.supporting_evidence || [])
    .filter((e) => e.has_photo)
    .map((e) => ({ submissionId: e.submission_id }));

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={clsx(
        "w-full text-left rounded-2xl border p-4 sm:p-5 transition-all duration-300 relative overflow-hidden group shadow-xs cursor-pointer",
        isSelected
          ? "border-civic-500 bg-gradient-to-br from-white to-civic-50/50 shadow-md ring-1 ring-civic-500/20"
          : "border-surface-200 bg-white hover:border-civic-500/50 hover:shadow-sm"
      )}
    >
      <div className="flex items-start gap-4">
        {/* Rank Badge */}
        <div className="flex flex-col items-center justify-center bg-surface-100 rounded-xl w-11 h-11 shrink-0 border border-surface-200">
          <span className="text-[10px] uppercase font-bold text-surface-500 leading-none">Rank</span>
          <span className="font-display font-900 text-lg text-civic-600 leading-none mt-0.5">
            {item.rank}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-surface-900 leading-snug group-hover:text-civic-600 transition-colors">
            {item.title}
          </h3>

          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <CategoryBadge category={item.category} />
            <span className="inline-flex items-center gap-1 text-xs font-medium text-surface-700 bg-surface-100 px-2.5 py-0.5 rounded-full border border-surface-200">
              <Users size={12} /> {item.demand_count}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 shadow-2xs">
              <Activity size={12} /> {rating.total}/{rating.max} AI Score
            </span>
            {item.predictive_status && (
              <span className={clsx(
                "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shadow-2xs",
                item.predictive_status === "System-Detected"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              )}>
                <span>{item.predictive_status === "System-Detected" ? "⚡ System-Detected" : "👤 Confirmed"}</span>
              </span>
            )}
            {item.status === "Resolved" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                ✓ Resolved
              </span>
            ) : item.status === "Assigned" || item.assigned_department ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200" title={item.assigned_department}>
                🏢 Assigned
              </span>
            ) : null}
            {item.department && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-civic-700 bg-civic-50 px-2.5 py-0.5 rounded-full border border-civic-200 shadow-2xs">
                <Building2 size={12} /> {item.department.short_name}
              </span>
            )}
            {item.sla_status && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-surface-700 bg-surface-100 px-2.5 py-0.5 rounded-full border border-surface-200 shadow-2xs">
                <Clock size={12} /> {item.sla_status}
              </span>
            )}
          </div>
          
          {/* AI rating: four dimensions, each 1–5 (overall = their sum / 20) */}
          <div className="mt-3.5">
            <div className="flex justify-between items-end mb-1.5">
              <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wide">
                AI rating &middot; {rating.total}/{rating.max}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {RATING_DIMENSIONS.map((dim) => (
                <div key={dim.key} title={`${dim.label}: ${rating[dim.key]}/5 — ${dim.hint}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-bold uppercase ${dim.tone}`}>
                      {dim.label.slice(0, 4)}
                    </span>
                    <span className="text-[9px] font-bold text-surface-500">
                      {rating[dim.key]}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full bg-surface-100 rounded-full overflow-hidden border border-surface-200/50">
                    <div
                      className={`${dim.bar} h-full rounded-full`}
                      style={{ width: `${(rating[dim.key] / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <ChevronRight
          size={20}
          className={clsx(
            "text-surface-400 shrink-0 mt-2 transition-transform duration-300",
            isSelected && "rotate-90 text-civic-600"
          )}
        />
      </div>

      {photoImages.length > 0 && (
        <div className="mt-3">
          <EvidenceAttachments images={photoImages} />
        </div>
      )}
    </div>
  );
}
