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

      <div className="mt-5 p-4 rounded-md bg-civic-50 border border-civic-100">
        <h3 className="text-xs font-semibold text-civic-700 uppercase tracking-wide mb-1.5">
          Why this ranking
        </h3>
        <p className="text-sm text-ink-900 leading-relaxed">
          {item.explanation}
        </p>
      </div>

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
