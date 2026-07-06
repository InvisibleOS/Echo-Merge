"use client";

import { useEffect, useState } from "react";
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
import CopilotPanel from "./CopilotPanel";

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
          const [p, h, c, healthData, deptData, insightData] = await Promise.all([
            getPriorities(constituency),
            getHotspots(constituency),
            getCases({ constituency }),
            getConstituencyHealth(constituency || "Bengaluru South"),
            getDepartmentAnalytics(constituency || "Bengaluru South"),
            getGovernanceInsights(constituency || "Bengaluru South"),
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
    // Refresh every 30s so new submissions surface without a manual reload
    const interval = setInterval(load, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [constituency]);

  const selectedItem = priorities.find((p) => p.work_id === selectedId) || null;

  function handleSelect(workId: string) {
    setSelectedId((current) => (current === workId ? null : workId));
  }

  async function handleUpdateCaseStatus(caseId: string, status: string) {
    const updated = await updateCaseStatus(caseId, status, `MP dashboard marked ${status}.`);
    if (!updated) return;
    setCases((current) =>
      current.map((item) => (item.case_id === caseId ? { ...item, ...updated } : item))
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-ink-950">
      <header className="px-6 py-4 border-b border-white/10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shrink-0">
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
        <div className="flex flex-wrap items-center gap-4">
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
          <span className="text-xs text-white/40">
            {priorities.length} ranked priorities
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

        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr_380px] gap-4 min-h-[620px]">
          <div className="space-y-4 min-w-0">
            <div className="overflow-y-auto bg-ink-900/60 rounded-lg p-4 border border-white/5 max-h-[620px]">
              <PriorityList
                items={priorities}
                isLoading={isLoading}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            </div>
          </div>

          <div className="relative min-h-[520px]">
            <HotspotMap
              hotspots={hotspots}
              priorities={priorities}
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

          <div className="space-y-4 min-w-0">
            <CaseQueue cases={cases} onUpdateStatus={handleUpdateCaseStatus} />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr_380px] gap-4">
          <DepartmentAnalyticsPanel departments={departments} />
          <GovernanceInsightsPanel insights={insights} />
          <CopilotPanel constituency={constituency || "Bengaluru South"} />
        </div>
      </div>
    </div>
  );
}
