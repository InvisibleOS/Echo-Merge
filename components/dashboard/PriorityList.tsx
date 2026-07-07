"use client";

import { PriorityItem } from "@/lib/types";
import PriorityCard from "./PriorityCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface Props {
  items: PriorityItem[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (workId: string) => void;
}

export default function PriorityList({
  items,
  isLoading,
  selectedId,
  onSelect,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        <LoadingSpinner size={24} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-surface-500 text-sm font-medium">
          No priorities yet. As citizens submit reports, ranked development
          needs will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <PriorityCard
          key={item.work_id}
          item={item}
          isSelected={selectedId === item.work_id}
          onSelect={() => onSelect(item.work_id)}
        />
      ))}
    </div>
  );
}
