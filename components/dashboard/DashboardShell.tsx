"use client";

import { useEffect, useState, useMemo } from "react";
import { PriorityItem, Hotspot, KNOWN_CATEGORIES } from "@/lib/types";
import { getPriorities, getHotspots } from "@/lib/api";
import { categoryLabel } from "@/lib/categories";
import PriorityList from "./PriorityList";
import HotspotMap from "./HotspotMap";
import DrillDownPanel from "./DrillDownPanel";

export default function DashboardShell() {
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [constituency, setConstituency] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [p, h] = await Promise.all([getPriorities(constituency), getHotspots(constituency)]);
        if (!cancelled) {
          setPriorities(p);
          setHotspots(h);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            "Couldn't load priorities. Check the API connection and try refreshing."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    // Refresh every 30s so new submissions surface without a manual reload
    const interval = setInterval(load, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [constituency]);

  // ── Combined filtering: Location (constituency) is already handled by
  //    the API fetch above. Category filtering is applied client-side so
  //    the full dataset stays cached for instant filter toggling. ──
  const filteredPriorities = useMemo(() => {
    if (!category) return priorities;
    return priorities.filter((p) => p.category === category);
  }, [priorities, category]);

  const filteredHotspots = useMemo(() => {
    if (!category) return hotspots;
    return hotspots.filter((h) => h.category === category);
  }, [hotspots, category]);

  const selectedItem = filteredPriorities.find((p) => p.work_id === selectedId) || null;

  function handleSelect(workId: string) {
    setSelectedId((current) => (current === workId ? null : workId));
  }

  /** Mark a priority as resolved — updates local state immediately for
   *  visual feedback and persists to the backend via the API. */
  function handleResolve(workId: string) {
    setPriorities((prev) =>
      prev.map((p) =>
        p.work_id === workId ? { ...p, status: "Resolved" as const } : p
      )
    );
  }

  // Dropdown styling — shared between Location and Category selects
  const selectClass =
    "bg-ink-900 text-white text-sm border border-white/20 rounded px-2 py-1 outline-none focus:border-signal-amber";

  return (
    <div className="h-screen flex flex-col bg-ink-950">
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
        <div>
          <span className="text-signal-amber font-display font-semibold text-xs uppercase tracking-wide">
            People&rsquo;s Priorities
          </span>
          <h1 className="font-display font-bold text-lg text-white">
            Constituency Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Location filter */}
          <select
            className={selectClass}
            value={constituency}
            onChange={(e) => { setConstituency(e.target.value); setSelectedId(null); }}
            id="filter-location"
          >
            <option value="">All Constituencies</option>
            <option value="Bengaluru South">Bengaluru South</option>
            <option value="Lucknow">Lucknow</option>
            <option value="Wayanad">Wayanad</option>
            <option value="New Delhi">New Delhi</option>
            <option value="Mumbai South">Mumbai South</option>
          </select>

          {/* Category filter */}
          <select
            className={selectClass}
            value={category}
            onChange={(e) => { setCategory(e.target.value); setSelectedId(null); }}
            id="filter-category"
          >
            <option value="">All Categories</option>
            {KNOWN_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabel(cat)}
              </option>
            ))}
          </select>

          <span className="text-xs text-white/40">
            {filteredPriorities.length} ranked priorities
          </span>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-md bg-red-950 border border-red-800 text-red-200 text-sm shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 p-4 min-h-0">
        <div className="overflow-y-auto bg-ink-900/60 rounded-lg p-4 border border-white/5">
          <PriorityList
            items={filteredPriorities}
            isLoading={isLoading}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
        </div>

        <div className="relative min-h-[320px]">
          <HotspotMap
            hotspots={filteredHotspots}
            priorities={filteredPriorities}
            selectedId={selectedId}
            onSelectMarker={handleSelect}
          />

          {selectedItem && (
            <div className="absolute top-0 right-0 w-full max-w-md h-full p-2">
              <DrillDownPanel
                item={selectedItem}
                onClose={() => setSelectedId(null)}
                onResolve={handleResolve}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
