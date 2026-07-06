"use client";

import { useEffect, useState, useMemo } from "react";
import { PriorityItem, Hotspot } from "@/lib/types";
import { getPriorities, getHotspots } from "@/lib/api";
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

  const uniqueCategories = useMemo(() => {
    const cats = new Set(priorities.map(p => p.category));
    return Array.from(cats).sort();
  }, [priorities]);

  const filteredPriorities = useMemo(() => {
    let filtered = priorities;
    if (category) {
      filtered = filtered.filter(p => p.category === category);
    }
    // Re-rank from 1 to N within this filtered list (assuming they are already sorted by demand_score desc)
    return filtered.map((p, index) => ({
      ...p,
      rank: index + 1
    }));
  }, [priorities, category]);

  const filteredHotspots = useMemo(() => {
    if (!category) return hotspots;
    // We only want hotspots for priorities in the selected category
    const validWorkIds = new Set(filteredPriorities.map(p => p.work_id));
    return hotspots.filter(h => validWorkIds.has(h.work_id));
  }, [hotspots, category, filteredPriorities]);

  const selectedItem = filteredPriorities.find((p) => p.work_id === selectedId) || null;

  function handleSelect(workId: string) {
    setSelectedId((current) => (current === workId ? null : workId));
  }

  return (
    <div className="h-screen flex flex-col bg-ink-950">
      <header className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between shrink-0 gap-4">
        <div>
          <span className="text-signal-amber font-display font-semibold text-xs uppercase tracking-wide">
            People&rsquo;s Priorities
          </span>
          <h1 className="font-display font-bold text-lg text-white">
            Constituency Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <select 
            className="bg-ink-900 text-white text-sm border border-white/20 rounded px-2 py-1 outline-none focus:border-signal-amber"
            value={constituency}
            onChange={(e) => setConstituency(e.target.value)}
          >
            <option value="">All Constituencies</option>
            <option value="Bengaluru South">Bengaluru South</option>
            <option value="Lucknow">Lucknow</option>
            <option value="Wayanad">Wayanad</option>
            <option value="New Delhi">New Delhi</option>
            <option value="Mumbai South">Mumbai South</option>
          </select>

          <select 
            className="bg-ink-900 text-white text-sm border border-white/20 rounded px-2 py-1 outline-none focus:border-signal-amber"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setSelectedId(null); // Reset selection when changing category
            }}
          >
            <option value="">All Categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
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
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
