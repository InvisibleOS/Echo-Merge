"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PriorityItem,
  Hotspot,
  ActionCase,
  ConstituencyHealth,
  DepartmentAnalytics,
  GovernanceInsights,
} from "@/lib/types";
import {
  getPriorities,
  getHotspots,
  getCases,
  getConstituencyHealth,
  getDepartmentAnalytics,
  getGovernanceInsights,
  updateCaseStatus,
} from "@/lib/api";
import PriorityList from "./PriorityList";
import HotspotMap from "./HotspotMap";
import DrillDownPanel from "./DrillDownPanel";
import HealthOverview from "./HealthOverview";
import CaseQueue from "./CaseQueue";
import DepartmentAnalyticsPanel from "./DepartmentAnalyticsPanel";
import GovernanceInsightsPanel from "./GovernanceInsightsPanel";

export default function DashboardShell() {
  const [priorities, setPriorities] = useState<PriorityItem[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [cases, setCases] = useState<ActionCase[]>([]);
  const [health, setHealth] = useState<ConstituencyHealth | null>(null);
  const [departments, setDepartments] = useState<DepartmentAnalytics[]>([]);
  const [insights, setInsights] = useState<GovernanceInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [constituency, setConstituency] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [updatingCaseId, setUpdatingCaseId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const activeConstituency = constituency || "Bengaluru South";
        const [p, h, c, healthData, deptData, insightData] = await Promise.all([
          getPriorities(constituency),
          getHotspots(constituency),
          getCases({ constituency }),
          getConstituencyHealth(activeConstituency),
          getDepartmentAnalytics(activeConstituency),
          getGovernanceInsights(activeConstituency),
        ]);
        if (!cancelled) {
          setPriorities(p);
          setHotspots(h);
          setCases(c);
          setHealth(healthData);
          setDepartments(deptData);
          setInsights(insightData);
        }
      } catch {
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
    const interval = setInterval(load, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [constituency]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(priorities.map((p) => p.category));
    return Array.from(cats).sort();
  }, [priorities]);

  const filteredPriorities = useMemo(() => {
    let filtered = priorities;
    if (constituency) {
      filtered = filtered.filter(p => p.constituency === constituency);
    }
    if (category) {
      filtered = filtered.filter(p => p.category === category);
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
      filtered = filtered.filter(h => h.category === category);
    }
    return filtered;
  }, [hotspots, category]);

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
      const freshHotspots = await getHotspots(constituency || undefined);
      setHotspots(freshHotspots);
    } catch (err) {
      console.error("Failed to refresh hotspots after resolve", err);
    }
  }

  async function handleUpdateCaseStatus(caseId: string, status: string, departmentId?: string) {
    setUpdatingCaseId(caseId);
    setError(null);
    try {
      const updated = await updateCaseStatus(
        caseId,
        status,
        `MP dashboard marked ${status}.`,
        departmentId
      );
      if (!updated) {
        setError("Couldn't update that case. Please refresh and try again.");
        return;
      }
      setCases((current) =>
        current.map((item) => (item.case_id === caseId ? { ...item, ...updated } : item))
      );
    } catch {
      setError("Couldn't update that case. Please refresh and try again.");
    } finally {
      setUpdatingCaseId(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-ink-950">
      <header className="px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between shrink-0 gap-4">
        <div>
          <span className="text-signal-amber font-display font-semibold text-xs uppercase tracking-wide">
            Constituency Intelligence & Action OS
          </span>
          <h1 className="font-display font-bold text-xl text-white">
            MP Command Center
          </h1>
          <p className="text-xs text-white/45 mt-1">
            Detect, prioritize, assign, resolve, and monitor constituency issues.
          </p>
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
              setSelectedId(null);
            }}
          >
            <option value="">All Categories</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
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

      <div className="p-4 space-y-4">
        <HealthOverview health={health} isLoading={isLoading} />

        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr_380px] gap-4 min-h-[620px]">
          <div className="overflow-y-auto bg-ink-900/60 rounded-lg p-4 border border-white/5 max-h-[620px]">
            <PriorityList
              items={filteredPriorities}
              isLoading={isLoading}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>

          <div className="relative min-h-[520px]">
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
                  onResolve={handleResolvePriority}
                />
              </div>
            )}
          </div>

          <CaseQueue
            cases={cases}
            updatingCaseId={updatingCaseId}
            onUpdateStatus={handleUpdateCaseStatus}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4">
          <DepartmentAnalyticsPanel departments={departments} />
          <GovernanceInsightsPanel insights={insights} />
        </div>
      </div>
    </div>
  );
}
