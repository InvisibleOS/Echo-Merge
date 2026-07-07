"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { PriorityItem, Hotspot } from "@/lib/types";
import { getPriorities, getHotspots } from "@/lib/api";
import { subscribeToSync } from "@/lib/storageSync";
import PriorityList from "./PriorityList";
import HotspotMap from "./HotspotMap";
import DrillDownPanel from "./DrillDownPanel";
import ProactiveAnalysisPanel from "./ProactiveAnalysisPanel";
import DelegationPanel from "./DelegationPanel";
import { Map, Cpu, Building2, Users, ArrowLeft, Landmark } from "lucide-react";
import clsx from "clsx";

export default function DashboardShell() {
  const [activeTab, setActiveTab] = useState<"map" | "analysis" | "delegation">("map");
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [constituency, setConstituency] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const [p, h] = await Promise.all([getPriorities(constituency), getHotspots(constituency)]);
      setPriorities(p);
      setHotspots(h);
    } catch {
      setError(
        "Couldn't load priorities. Check the API connection and try refreshing."
      );
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [constituency]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(true);
    }, 0);
    // Subscribe to storage sync events for real-time reflection across windows/tabs
    const unsubscribe = subscribeToSync(() => {
      void load(false);
    });

    const interval = setInterval(() => void load(false), 30000);

    return () => {
      clearTimeout(timer);
      unsubscribe();
      clearInterval(interval);
    };
  }, [load]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(priorities.map(p => p.category));
    return Array.from(cats).sort();
  }, [priorities]);

  // ── Combined filtering: Location (constituency) is already handled by
  //    the API fetch above. Category filtering is applied client-side so
  //    the full dataset stays cached for instant filter toggling. ──
  const filteredPriorities = useMemo(() => {
    let filtered = priorities;
    if (category) {
      filtered = filtered.filter(p => p.category === category);
    }
    return filtered.map((p, index) => ({
      ...p,
      rank: index + 1
    }));
  }, [priorities, category]);

  const filteredHotspots = useMemo(() => {
    if (!category) return hotspots;
    return hotspots.filter(h => h.category === category);
  }, [hotspots, category]);

  const selectedItem = filteredPriorities.find((p) => p.work_id === selectedId) || null;

  function handleSelect(workId: string) {
    setSelectedId((current) => (current === workId ? null : workId));
  }

  return (
    <div className="h-screen flex flex-col bg-surface-50 text-surface-900 font-body">
      {/* ── Top Header Bar ── */}
      <header className="px-6 py-3.5 border-b border-surface-200 flex flex-wrap items-center justify-between shrink-0 gap-4 bg-white z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-surface-700 hover:text-surface-900 transition-colors"
            title="Back to Landing Gate"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
            <Landmark size={18} />
          </div>
          <div>
            <span className="text-amber-600 font-display font-semibold text-[10px] uppercase tracking-wide block">
              People&rsquo;s Priorities &bull; Representative Portal
            </span>
            <h1 className="font-display font-bold text-base sm:text-lg text-surface-900 leading-tight">
              Constituency Executive Control Center
            </h1>
          </div>
        </div>

        {/* Filters and Portal Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          <select 
            className="bg-white text-surface-900 text-xs sm:text-sm border border-surface-200 rounded-lg px-3 py-1.5 outline-none focus:border-civic-500 transition-colors font-medium shadow-sm"
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

          {activeTab === "map" && (
            <select 
              className="bg-white text-surface-900 text-xs sm:text-sm border border-surface-200 rounded-lg px-3 py-1.5 outline-none focus:border-civic-500 transition-colors font-medium shadow-sm"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSelectedId(null);
              }}
            >
              <option value="">All Categories</option>
              {uniqueCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}

          <Link
            href="/citizen"
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-200 border border-surface-200 text-xs font-semibold text-surface-900 transition-colors shadow-sm"
          >
            <Users size={14} className="text-civic-600" />
            <span>Switch to Citizen Portal →</span>
          </Link>
        </div>
      </header>

      {/* ── Three-Tab Navigation Bar ── */}
      <nav className="bg-white/80 backdrop-blur px-6 py-2.5 border-b border-surface-200 flex items-center gap-2.5 shrink-0 overflow-x-auto shadow-2xs">
        <button
          onClick={() => setActiveTab("map")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-display font-semibold text-xs transition-all whitespace-nowrap",
            activeTab === "map"
              ? "bg-surface-900 text-white shadow-sm"
              : "text-surface-700 hover:text-surface-900 hover:bg-surface-100"
          )}
          id="tab-complaint-map"
        >
          <Map size={15} />
          <span>1. Complaint Map &amp; Hotspots</span>
          <span className={clsx(
            "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold",
            activeTab === "map" ? "bg-white/20 text-white" : "bg-surface-200 text-surface-700"
          )}>
            {filteredPriorities.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("analysis")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-display font-semibold text-xs transition-all whitespace-nowrap",
            activeTab === "analysis"
              ? "bg-surface-900 text-white shadow-sm"
              : "text-surface-700 hover:text-surface-900 hover:bg-surface-100"
          )}
          id="tab-realtime-analysis"
        >
          <Cpu size={15} />
          <span>2. Real-time Area Analysis</span>
          <span className="ml-1 px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-[10px] font-mono font-bold">
            ⚡ Proactive Mapbox
          </span>
        </button>

        <button
          onClick={() => setActiveTab("delegation")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-display font-semibold text-xs transition-all whitespace-nowrap",
            activeTab === "delegation"
              ? "bg-surface-900 text-white shadow-sm"
              : "text-surface-700 hover:text-surface-900 hover:bg-surface-100"
          )}
          id="tab-management-delegation"
        >
          <Building2 size={15} />
          <span>3. Management &amp; Delegation</span>
          <span className="ml-1 px-2 py-0.5 bg-purple-50 text-purple-600 border border-purple-200 rounded-full text-[10px] font-mono font-bold">
            Assign Tasks
          </span>
        </button>
      </nav>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm shrink-0 shadow-sm font-medium">
          {error}
        </div>
      )}

      {/* ── Main Tab View Area ── */}
      {activeTab === "map" && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4 p-5 min-h-0 bg-surface-50">
          <div className="overflow-y-auto bg-white rounded-2xl p-4 border border-surface-200 shadow-sm">
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
              <div className="absolute top-0 right-0 w-full max-w-md h-full p-2 z-10">
                <DrillDownPanel
                  item={selectedItem}
                  onClose={() => setSelectedId(null)}
                  onResolve={() => load(false)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "analysis" && (
        <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-surface-50">
          <div className="max-w-7xl mx-auto">
            <ProactiveAnalysisPanel />
          </div>
        </div>
      )}

      {activeTab === "delegation" && (
        <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-surface-50">
          <div className="max-w-7xl mx-auto">
            <DelegationPanel
              priorities={filteredPriorities}
              onDelegationUpdate={() => load(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
