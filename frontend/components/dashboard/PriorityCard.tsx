"use client";

import { PriorityItem } from "@/lib/types";
import { CategoryBadge } from "@/components/ui/Badge";
import { Users, ChevronRight } from "lucide-react";
import clsx from "clsx";

interface Props {
  item: PriorityItem;
  isSelected: boolean;
  onSelect: () => void;
}

export default function PriorityCard({ item, isSelected, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className={clsx(
        "w-full text-left rounded-md border p-4 transition-colors",
        isSelected
          ? "border-civic-500 bg-civic-50"
          : "border-ink-900/10 bg-white hover:border-civic-400/50"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="font-display font-800 text-2xl text-civic-500/40 leading-none pt-0.5">
          {String(item.rank).padStart(2, "0")}
        </span>

        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-ink-900 leading-snug">
            {item.title}
          </h3>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <CategoryBadge category={item.category} />
            <span className="inline-flex items-center gap-1 text-xs text-ink-800/60">
              <Users size={13} /> {item.demand_count} citizens
            </span>
          </div>

          <p className="text-xs text-ink-800/60 mt-2 line-clamp-2">
            {item.explanation}
          </p>
        </div>

        <ChevronRight
          size={18}
          className={clsx(
            "text-ink-800/30 shrink-0 mt-1 transition-transform",
            isSelected && "rotate-90"
          )}
        />
      </div>
    </button>
  );
}
