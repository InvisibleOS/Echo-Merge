"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  PriorityItem,
  Hotspot,
  DepartmentAnalytics,
} from "@/lib/types";
import {
  getPriorities,
  getHotspots,
  getDepartmentAnalytics,
  getProactiveAlerts,
  resolvePriority,
} from "@/lib/api";
import { subscribeToSync } from "@/lib/storageSync";
import { CITIES, CityConfig } from "@/lib/cities";
import PriorityList from "./PriorityList";
import DrillDownPanel from "./DrillDownPanel";
import ProactiveAnalysisPanel from "./ProactiveAnalysisPanel";
import DelegationPanel from "./DelegationPanel";
import DepartmentAnalyticsPanel from "./DepartmentAnalyticsPanel";
import { Map, Cpu, Building2, Users, ShieldCheck } from "lucide-react";
import clsx from "clsx";

const HotspotMap = dynamic(() => import("./HotspotMap"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 h-full w-full flex items-center justify-center bg-surface-100 rounded-3xl animate-pulse">
      <span className="text-surface-500 font-medium text-sm">Loading map...</span>
    </div>
  ),
});

// Complaints within this radius (km) of the selected city's centre are shown on
// the map/list — so choosing a city both flies there AND reveals that city's
// complaints, instead of the old exact-string constituency filter that matched
// nothing (priorities are rarely tagged with a constituency) and emptied the map.
const CITY_FOCUS_RADIUS_KM = 70;

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Sentinel "city" for the nationwide view — no proximity filter, map fits India.
const ALL_INDIA: CityConfig = { id: "all", name: "All India", lat: 22.9, lng: 79.5, zoom: 4.2, corporation: "Nationwide" };

function withinCity(geo: { lat?: number; lng?: number } | undefined, city: CityConfig) {
  if (city.id === "all") return true; // nationwide view — show every complaint
  if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) return false;
  return distanceKm(geo.lat as number, geo.lng as number, city.lat, city.lng) <= CITY_FOCUS_RADIUS_KM;
}

// Sort dimensions map to the AI rating's per-category 1–5 scores (or the /20 total).
const SORT_OPTIONS = [
  { value: "overall", label: "Overall Score" },
  { value: "urgency", label: "Urgency" },
  { value: "impact", label: "Impact" },
  { value: "feasibility", label: "Feasibility" },
  { value: "cost", label: "Cost Efficiency" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["value"];

function sortScore(p: PriorityItem, key: SortKey): number {
  const r = p.ai_rating;
  if (!r) return p.demand_score ?? 0;
  if (key === "overall") return r.total ?? 0;
  return (r[key] as number) ?? 0;
}

export default function DashboardShell() {
  const [activeTab, setActiveTab] = useState<"map" | "analysis" | "delegation" | "workload">("map");
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [departments, setDepartments] = useState<DepartmentAnalytics[]>([]);
  const [proactiveCount, setProactiveCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string>("all");
  const [category, setCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("overall");
  // Management & Delegation queue ordering — by recency (most recent activity first).
  const [delegationSort, setDelegationSort] = useState<"recent" | "oldest">("recent");

  const activeCity = useMemo(
    () => (selectedCityId === "all" ? ALL_INDIA : CITIES.find((c) => c.id === selectedCityId) || CITIES[0]),
    [selectedCityId]
  );

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const city = CITIES.find((c) => c.id === selectedCityId);
      const [p, h, deptData] = await Promise.all([
        getPriorities(),
        getHotspots(),
        getDepartmentAnalytics(city?.name || "Bengaluru"),
      ]);
      setPriorities(p);
      setHotspots(h);
      setDepartments(deptData);
      // Proactive-alert count for the tab-2 badge. Best-effort and fire-and-forget
      // so it never blocks or fails the dashboard's core load.
      getProactiveAlerts()
        .then((a) => setProactiveCount(Array.isArray(a) ? a.length : 0))
        .catch(() => {});
    } catch {
      setError(
        "Couldn't load priorities. Check the API connection and try refreshing."
      );
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [selectedCityId]);

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

  const isProactive = (p: PriorityItem) => Boolean(p.title?.includes("[PROACTIVE"));

  // Tab 1 (map + list): citizen-complaint clusters only — keep proactively
  // crawled work orders off the public hotspot map. Focus on the selected city
  // by geographic proximity so markers AND heatmap stay consistent.
  const filteredPriorities = useMemo(() => {
    // Tab 1 holds UNASSIGNED citizen complaints only. The moment a complaint is
    // assigned to a department (or resolved) it leaves the map and moves to the
    // Management & Delegation queue (Tab 3).
    const filtered = priorities.filter(
      (p) =>
        p.status !== "Resolved" &&
        p.status !== "Assigned" &&
        !p.assigned_department &&
        !isProactive(p) &&
        withinCity(p.hotspot_geo, activeCity)
    );
    const scoped = category ? filtered.filter((p) => p.category === category) : filtered;
    // Sort by the chosen AI-rating dimension (desc), then re-rank 1..N.
    const sorted = [...scoped].sort((a, b) => sortScore(b, sortBy) - sortScore(a, sortBy));
    return sorted.map((p, index) => ({
      ...p,
      rank: index + 1,
    }));
  }, [priorities, category, activeCity, sortBy]);

  // Tab 3 (Management & Delegation): every open work order to delegate,
  // INCLUDING proactively-detected / converted ones (not city-scoped).
  const delegationPriorities = useMemo(() => {
    // Tab 3 holds ONLY complaints that have already been assigned to a department
    // (assignment happens on the complaint itself, not here). New/unassigned
    // complaints never appear until an MP assigns them.
    const filtered = priorities.filter(
      (p) => p.status === "Assigned" || p.status === "Resolved" || Boolean(p.assigned_department)
    );
    // Order by recency of activity (assign / resolve / rescore). "Most recent"
    // first by default, so a just-assigned work order leads the queue; "oldest"
    // flips it. Tie-break keeps a stable order.
    const ts = (p: PriorityItem) => (p.updated_at ? new Date(p.updated_at).getTime() : 0);
    const isDone = (p: PriorityItem) => (p.status === "Resolved" ? 1 : 0);
    const sorted = [...filtered].sort((a, b) => {
      // Resolved work orders always sink to the bottom of the queue.
      if (isDone(a) !== isDone(b)) return isDone(a) - isDone(b);
      return delegationSort === "oldest" ? ts(a) - ts(b) : ts(b) - ts(a);
    });
    return sorted.map((p, index) => ({ ...p, rank: index + 1 }));
  }, [priorities, delegationSort]);

  // Heatmap follows the same city focus as the markers so they never diverge.
  const filteredHotspots = useMemo(() => {
    let filtered = hotspots.filter((h) => withinCity(h.geo, activeCity));
    if (category) {
      filtered = filtered.filter((h) => h.category === category);
    }
    return filtered;
  }, [hotspots, category, activeCity]);

  const selectedItem =
    filteredPriorities.find((p) => p.work_id === selectedId) || null;

  function handleSelect(workId: string) {
    setSelectedId((current) => (current === workId ? null : workId));
  }

  async function handleResolvePriority(workId: string) {
    setPriorities((current) =>
      current.map((item) =>
        item.work_id === workId ? { ...item, status: "Resolved" } : item
      )
    );
    try {
      const freshHotspots = await getHotspots();
      setHotspots(freshHotspots);
    } catch (err) {
      console.error("Failed to refresh hotspots after resolve", err);
    }
  }

  // Resolve straight from the Management & Delegation queue (Tab 3). resolvePriority
  // writes the "Resolved" override + server PATCH and emits a storage-sync event,
  // which triggers a reload via subscribeToSync (mount effect) — that reload flips
  // the status, sinks the item to the bottom, and updates the citizen's matching
  // complaint. We deliberately do NOT optimistically flip status here: doing so
  // would unmount the row's resolve spinner before it can render, and would add a
  // redundant second refetch on top of the sync-driven one.
  async function handleDelegationResolve(workId: string) {
    try {
      await resolvePriority(workId);
    } catch (err) {
      console.error("Failed to resolve work order", err);
    }
  }

  return (
    <div className="h-screen flex flex-col mesh-bg text-surface-900 font-body relative overflow-hidden">
      {/* ── Top Header Bar ── */}
      <header className="px-6 py-3.5 border-b border-white/40 flex flex-wrap items-center justify-between shrink-0 gap-4 glass-nav z-20 shadow-sm">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            id="btn-return-home"
          >
            <ShieldCheck size={26} className="text-civic-600" />
            <div>
              <h1 className="font-display font-bold text-[17px] leading-tight text-ink-950 tracking-tight">
                Echo Merge
              </h1>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-civic-600/80 -mt-0.5">
                Proactive Governance
              </p>
            </div>
          </Link>

          <div className="h-8 w-px bg-surface-200 hidden sm:block" />

          {/* City Selector Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="city-select" className="text-xs font-semibold text-surface-700 uppercase tracking-wider">
              City:
            </label>
            <select
              id="city-select"
              value={selectedCityId}
              onChange={(e) => setSelectedCityId(e.target.value)}
              className="text-sm font-medium bg-white/50 border border-surface-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-civic-500/50"
            >
              <option value="all">🇮🇳 All India (Nationwide)</option>
              {CITIES.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} ({city.corporation})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filters and Portal Switcher */}
        <div className="flex items-center gap-3 flex-wrap">
          {activeTab === "map" && (
            <>
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

              <select
                title="Rank complaints by AI-rating dimension"
                className="bg-white text-surface-900 text-xs sm:text-sm border border-surface-200 rounded-lg px-3 py-1.5 outline-none focus:border-civic-500 transition-colors font-medium shadow-sm font-semibold"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortKey);
                  setSelectedId(null);
                }}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    Sort: {o.label}
                  </option>
                ))}
              </select>
            </>
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
      <nav className="glass-nav px-6 py-2.5 border-b border-white/40 flex items-center gap-2.5 shrink-0 overflow-x-auto shadow-sm z-10">
        <button
          onClick={() => setActiveTab("map")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-display font-bold text-xs transition-all duration-300 whitespace-nowrap border border-transparent shadow-sm hover:-translate-y-0.5",
            activeTab === "map"
              ? "bg-gradient-to-r from-ink-950 to-ink-800 text-white shadow-glow-civic"
              : "text-surface-700 hover:text-surface-900 bg-white/50 hover:bg-white"
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
            "flex items-center gap-2 px-4 py-2 rounded-xl font-display font-bold text-xs transition-all duration-300 whitespace-nowrap border border-transparent shadow-sm hover:-translate-y-0.5",
            activeTab === "analysis"
              ? "bg-gradient-to-r from-ink-950 to-ink-800 text-white shadow-glow-amber"
              : "text-surface-700 hover:text-surface-900 bg-white/50 hover:bg-white"
          )}
          id="tab-realtime-analysis"
        >
          <Cpu size={15} />
          <span>2. Real-time Area Analysis</span>
          <span className={clsx(
            "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold border",
            activeTab === "analysis" ? "bg-white/20 text-white border-white/10" : "bg-surface-200 text-surface-700 border-surface-300"
          )}>
            {proactiveCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("delegation")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-display font-bold text-xs transition-all duration-300 whitespace-nowrap border border-transparent shadow-sm hover:-translate-y-0.5",
            activeTab === "delegation"
              ? "bg-gradient-to-r from-ink-950 to-ink-800 text-white shadow-glow-civic"
              : "text-surface-700 hover:text-surface-900 bg-white/50 hover:bg-white"
          )}
          id="tab-management-delegation"
        >
          <Building2 size={15} />
          <span>3. Management &amp; Delegation</span>
          <span className={clsx(
            "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold border",
            activeTab === "delegation" ? "bg-white/20 text-white border-white/10" : "bg-surface-200 text-surface-700 border-surface-300"
          )}>
            {delegationPriorities.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("workload")}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-xl font-display font-bold text-xs transition-all duration-300 whitespace-nowrap border border-transparent shadow-sm hover:-translate-y-0.5",
            activeTab === "workload"
              ? "bg-gradient-to-r from-ink-950 to-ink-800 text-white shadow-glow-civic"
              : "text-surface-700 hover:text-surface-900 bg-white/50 hover:bg-white"
          )}
          id="tab-department-workload"
        >
          <Building2 size={15} />
          <span>4. Department Workload</span>
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
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-5 p-5 min-h-0 animate-slide-up-fade">
            {/* Left: Priority list */}
            <div className="overflow-y-auto glass-panel rounded-3xl p-4 h-full flex flex-col">
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
              <div className="glass-panel rounded-3xl p-1 shadow-glass h-full">
                <HotspotMap
                  hotspots={filteredHotspots}
                  priorities={filteredPriorities}
                  selectedId={selectedId}
                  onSelectMarker={handleSelect}
                  focusCity={activeCity}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Proactive Telemetry */}
        {activeTab === "analysis" && (
          <div className="flex-1 overflow-y-auto p-6 min-h-0 animate-slide-up-fade">
            <div className="max-w-7xl mx-auto glass-panel rounded-3xl overflow-hidden shadow-glass">
              <ProactiveAnalysisPanel
                activeCity={activeCity}
                onConverted={() => {
                  setActiveTab("delegation");
                  void load(false);
                }}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Delegation */}
        {activeTab === "delegation" && (
          <div className="flex-1 overflow-y-auto p-6 min-h-0 animate-slide-up-fade">
            <div className="max-w-7xl mx-auto glass-panel rounded-3xl overflow-hidden shadow-glass p-6">
              <DelegationPanel
                priorities={delegationPriorities}
                sortOrder={delegationSort}
                onSortChange={setDelegationSort}
                onResolve={handleDelegationResolve}
              />
            </div>
          </div>
        )}

        {/* Tab 4: Department Workload */}
        {activeTab === "workload" && (
          <div className="flex-1 overflow-y-auto p-6 min-h-0 animate-slide-up-fade">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="glass-panel rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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
          "fixed inset-0 z-50 overflow-hidden transition-all duration-500 ease-in-out",
          selectedItem ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop overlay */}
        <div
          className="absolute inset-0 bg-ink-950/20 backdrop-blur-md transition-opacity duration-500"
          onClick={() => setSelectedId(null)}
        />

        {/* Drawer content sliding in from right */}
        <div
          className={clsx(
            "absolute inset-y-0 right-0 max-w-lg w-full glass-panel shadow-2xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] transform border-l border-white/50",
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
