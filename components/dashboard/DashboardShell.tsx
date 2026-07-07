"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  PriorityItem,
  Hotspot,
  DepartmentAnalytics,
} from "@/lib/types";
import {
  getPriorities,
  getHotspots,
  getDepartmentAnalytics,
} from "@/lib/api";
import { subscribeToSync } from "@/lib/storageSync";
import PriorityList from "./PriorityList";
import HotspotMap from "./HotspotMap";
import DrillDownPanel from "./DrillDownPanel";
import ProactiveAnalysisPanel from "./ProactiveAnalysisPanel";
import DelegationPanel from "./DelegationPanel";
import DepartmentAnalyticsPanel from "./DepartmentAnalyticsPanel";
import { Map, Cpu, Building2, Users, ArrowLeft, Landmark } from "lucide-react";
import clsx from "clsx";

export default function DashboardShell() {
  const [activeTab, setActiveTab] = useState<"map" | "analysis" | "delegation" | "workload">("map");
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [departments, setDepartments] = useState<DepartmentAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [constituency, setConstituency] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const activeConstituency = constituency || "Bengaluru South";
      const [p, h, deptData] = await Promise.all([
        getPriorities(constituency),
        getHotspots(constituency),
        getDepartmentAnalytics(activeConstituency),
      ]);
      setPriorities(p);
      setHotspots(h);
      setDepartments(deptData);
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
    
    // Subscribe to storage sync events for real-time reflection
    const unsubscribe = subscribeToSync(() => {
      void load(false);
    });

    // Custom listener for manual triggers (e.g. from Proactive Panel)
    if (typeof window !== "undefined") {
      window.addEventListener("echo-storage-sync", () => {
        void load(false);
      });
    }

    const interval = setInterval(() => void load(false), 30000);

    return () => {
      clearTimeout(timer);
      unsubscribe();
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("echo-storage-sync", () => {
          void load(false);
        });
      }
    };
  }, [load]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(priorities.map((p) => p.category));
    return Array.from(cats).sort();
  }, [priorities]);

  const filteredPriorities = useMemo(() => {
    let filtered = priorities;
    if (constituency) {
      filtered = filtered.filter((p) => p.constituency === constituency);
    }
    if (category) {
      filtered = filtered.filter((p) => p.category === category);
    }
    // Re-rank from 1 to N within this filtered list (assuming they are already sorted by demand_score desc)
    return filtered.map((p, index) => ({
      ...p,
      rank: index + 1,
    }));
  }, [priorities, category, constituency]);

  const filteredHotspots = useMemo(() => {
    let filtered = hotspots;
    if (category) {
      filtered = filtered.filter((h) => h.category === category);
    }
    return filtered;
  }, [hotspots, category]);

  const selectedItem =
    filteredPriorities.find((p) => p.work_id === selectedId) || null;

  function handleSelect(workId: string) {
    setSelectedId((current) => (current === workId ? null : workId));
  }

  function handleResolvePriority(workId: string) {
    setPriorities((current) =>
      current.map((item) =>
        item.work_id === workId ? { ...item, status: "Resolved" } : item
      )
    );
  }

  return (
    <div className="h-screen flex flex-col bg-surface-50 text-surface-900 font-body relative overflow-hidden">
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
            className="bg-white text-surface-900 text-xs sm:text-sm border border-surface-200 rounded-lg px-3 py-1.5 outline-none focus:border-civic-500 transition-colors font-medium shadow-sm font-semibold"
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

          {activeTab === "map" && (
            <select 
              className="bg-white text-surface-900 text-xs sm:text-sm border border-surface-200 rounded-lg px-3 py-1.5 outline-none focus:border-civic-500 transition-colors font-medium shadow-sm font-semibold"
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
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-200 border border-surface-200 text-xs font-bold text-surface-900 transition-colors shadow-sm"
          >
            <Users size={14} className="text-civic-600" />
            <span>Switch to Citizen Portal →</span>
          </Link>
        </div>
      </header>

      {/* ── Navigation Bar ── */}
      <nav className="bg-white/80 backdrop-blur px-6 py-2.5 border-b border-surface-200 flex items-center gap-2.5 shrink-0 overflow-x-auto shadow-2xs">
        <button
          onClick={() => setActiveTab("map")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-display font-bold text-xs transition-all whitespace-nowrap border border-transparent shadow-3xs",
            activeTab === "map"
              ? "bg-surface-900 text-white"
              : "text-surface-700 hover:text-surface-900 hover:bg-surface-100"
          )}
          id="tab-complaint-map"
        >
          <Map size={15} />
          <span>1. Complaint Map &amp; Hotspots</span>
          <span className={clsx(
            "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold border",
            activeTab === "map" ? "bg-white/20 text-white border-white/10" : "bg-surface-200 text-surface-700 border-surface-300"
          )}>
            {filteredPriorities.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("analysis")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-display font-bold text-xs transition-all whitespace-nowrap border border-transparent shadow-3xs",
            activeTab === "analysis"
              ? "bg-surface-900 text-white"
              : "text-surface-700 hover:text-surface-900 hover:bg-surface-100"
          )}
          id="tab-realtime-analysis"
        >
          <Cpu size={15} />
          <span>2. Real-time Area Analysis</span>
          <span className="ml-1 px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-[10px] font-mono font-bold">
            ⚡ Proactive Mapbox
          </span>
        </button>

        <button
          onClick={() => setActiveTab("delegation")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-display font-bold text-xs transition-all whitespace-nowrap border border-transparent shadow-3xs",
            activeTab === "delegation"
              ? "bg-surface-900 text-white"
              : "text-surface-700 hover:text-surface-900 hover:bg-surface-100"
          )}
          id="tab-management-delegation"
        >
          <Building2 size={15} />
          <span>3. Management &amp; Delegation</span>
        </button>

        <button
          onClick={() => setActiveTab("workload")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-display font-bold text-xs transition-all whitespace-nowrap border border-transparent shadow-3xs",
            activeTab === "workload"
              ? "bg-surface-900 text-white"
              : "text-surface-700 hover:text-surface-900 hover:bg-surface-100"
          )}
          id="tab-department-workload"
        >
          <Building2 size={15} />
          <span>4. Department Workload</span>
          <span className={clsx(
            "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold border",
            activeTab === "workload" ? "bg-white/20 text-white border-white/10" : "bg-surface-200 text-surface-700 border-surface-300"
          )}>
            {departments.length}
          </span>
        </button>
      </nav>

      {error && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm shrink-0 shadow-sm font-medium">
          {error}
        </div>
      )}

      {/* ── Main Tab Contents ── */}
      <div className="flex-1 min-h-0 flex flex-col relative">
        
        {/* Tab 1: Map and Priorities */}
        {activeTab === "map" && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-5 p-5 min-h-0 bg-surface-50">
            {/* Left: Priority list */}
            <div className="overflow-y-auto bg-white rounded-2xl p-4 border border-surface-200 shadow-sm h-full flex flex-col">
              <PriorityList
                items={filteredPriorities}
                isLoading={isLoading}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            </div>

            {/* Right: Map focusing full remaining space */}
            <div className="relative rounded-2xl overflow-hidden shadow-sm border border-surface-200 h-full min-h-[500px]">
              {isLoading && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-xs flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 rounded-full border-3 border-civic-500 border-t-transparent animate-spin" />
                    <span className="text-xs font-bold text-surface-700">Syncing database...</span>
                  </div>
                </div>
              )}
              <HotspotMap
                hotspots={filteredHotspots}
                priorities={filteredPriorities}
                selectedId={selectedId}
                onSelectMarker={handleSelect}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Proactive Telemetry */}
        {activeTab === "analysis" && (
          <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-surface-50">
            <div className="max-w-7xl mx-auto">
              <ProactiveAnalysisPanel />
            </div>
          </div>
        )}

        {/* Tab 3: Delegation */}
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

        {/* Tab 4: Department Workload */}
        {activeTab === "workload" && (
          <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-surface-50">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-civic-600 uppercase tracking-widest bg-civic-50 px-2 py-0.5 rounded border border-civic-200 mb-1">
                    <Building2 size={13} />
                    <span>Municipal Operations &amp; Workload Monitoring</span>
                  </div>
                  <h2 className="font-display font-bold text-xl text-surface-900">
                    Department SLA Performance &amp; Caseload
                  </h2>
                  <p className="text-xs text-surface-700 mt-1 font-semibold">
                    Track real-time active cases, SLA breaches, and overall compliance score across municipal agencies.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-sm">
                <DepartmentAnalyticsPanel departments={departments} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Slide-out Side Drawer ── */}
      <div
        className={clsx(
          "fixed inset-0 z-50 overflow-hidden transition-all duration-300 ease-in-out",
          selectedItem ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop overlay */}
        <div
          className="absolute inset-0 bg-black/45 backdrop-blur-xs transition-opacity duration-300"
          onClick={() => setSelectedId(null)}
        />

        {/* Drawer content sliding in from right */}
        <div
          className={clsx(
            "absolute inset-y-0 right-0 max-w-lg w-full bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out transform border-l border-surface-200",
            selectedItem ? "translate-x-0" : "translate-x-full"
          )}
        >
          {selectedItem && (
            <div className="flex-1 overflow-y-auto h-full">
              <DrillDownPanel
                item={selectedItem}
                onClose={() => setSelectedId(null)}
                onResolve={(workId) => {
                  handleResolvePriority(workId);
                  void load(false);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
