import clsx from "clsx";
import { UrgencyLevel, IssueCategory } from "@/lib/types";
import { categoryLabel } from "@/lib/categories";

const URGENCY_STYLES: Record<UrgencyLevel, string> = {
  Critical: "bg-red-100 text-red-700 border-red-200",
  High: "bg-amber-100 text-amber-700 border-amber-200",
  Medium: "bg-civic-100 text-civic-700 border-civic-400/30",
  Low: "bg-green-100 text-green-700 border-green-200",
};

export function UrgencyBadge({ level }: { level: UrgencyLevel }) {
  const style = URGENCY_STYLES[level] ?? URGENCY_STYLES.Medium;
  return (
    <span
      className={clsx(
        "inline-block px-2.5 py-1 rounded-sm text-xs font-semibold border",
        style
      )}
    >
      {level}
    </span>
  );
}

export function CategoryBadge({ category }: { category: IssueCategory }) {
  return (
    <span className="inline-block px-2.5 py-1 rounded-sm text-xs font-semibold border border-ink-900/15 text-ink-800 bg-ink-900/5">
      {categoryLabel(category)}
    </span>
  );
}
