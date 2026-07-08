"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { ProactiveAlert, ProactivePriorityLevel, IngestionType } from "@/lib/types";
import { getProactiveAlerts, convertProactiveAlert, ingestNews } from "@/lib/api";
import { CityConfig } from "@/lib/cities";
import { CategoryBadge } from "@/components/ui/Badge";
import {
  Radio,
  AlertTriangle,
  ShieldAlert,
  Cpu,
  MapPin,
  ArrowUpRight,
  Clock,
  Filter,
  Search,
  Activity,
  Zap,
  CheckCircle,
  ArrowLeft,
  Newspaper,
  Loader2,
} from "lucide-react";
import clsx from "clsx";

// Alerts within this radius (km) of the selected city are shown on the panel.
const CITY_ALERT_RADIUS_KM = 120;

// AdvancedMarkerElement requires a Map ID; a cloud-styled id can come from env,
// else Google's built-in DEMO_MAP_ID renders fine for the demo.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

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

function nearCity(geo: { lat?: number; lng?: number } | undefined, city: CityConfig) {
  if (city.id === "all") return true; // nationwide view — show every alert
  if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) return false;
  return distanceKm(geo.lat as number, geo.lng as number, city.lat, city.lng) <= CITY_ALERT_RADIUS_KM;
}

// Project a point onto a ~0.44° window around the active city (token-free fallback).
function projectLocalPoint(lat: number, lng: number, city: CityConfig) {
  const pad = 0.22;
  const x = ((Number(lng) - (city.lng - pad)) / (2 * pad)) * 100;
  const y = (1 - (Number(lat) - (city.lat - pad)) / (2 * pad)) * 100;
  return { x: Math.max(4, Math.min(96, x)), y: Math.max(5, Math.min(95, y)) };
}

interface Props {
  /** Called after an alert is successfully converted into an actionable work order. */
  onConverted?: () => void;
  /** Currently selected city (or the "All India" sentinel) — scopes + flies the map. */
  activeCity: CityConfig;
}

export default function ProactiveAnalysisPanel({ onConverted, activeCity }: Props) {
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [filterPriority, setFilterPriority] = useState<string>("All");
  const [filterIngestion, setFilterIngestion] = useState<string>("All");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [isConvertingId, setIsConvertingId] = useState<string | null>(null);

  const [convertedIds, setConvertedIds] = useState<Record<string, boolean>>({});

  const [isScanning, setIsScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerLibRef = useRef<google.maps.MarkerLibrary | null>(null);
  const markersRef = useRef<Record<string, google.maps.marker.AdvancedMarkerElement>>({});
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const showFallbackMap = !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || mapError;

  // Fetch proactive alerts from database API
  const fetchAlerts = useCallback(async (showLoading = true) => {
    if (showLoading) setIsFetching(true);
    try {
      const res = await getProactiveAlerts();
      setAlerts(res || []);
    } catch (err) {
      console.error("Failed to load proactive alerts:", err);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAlerts(false);
  }, [fetchAlerts]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(alerts.map((a) => a.category));
    return ["All", ...Array.from(cats)];
  }, [alerts]);

  // Filter alerts — scoped to the selected city, then by the on-panel controls.
  const filtered = useMemo(() => {
    return alerts.filter((item) => {
      if (!nearCity(item.geo, activeCity)) return false;
      if (filterPriority !== "All" && item.priority !== filterPriority) return false;
      if (filterIngestion !== "All" && item.ingestion_type !== filterIngestion) return false;
      if (filterCategory !== "All" && item.category !== filterCategory) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDetails = item.details.toLowerCase().includes(q);
        const matchLocation = item.location_label.toLowerCase().includes(q);
        const matchSource = item.source.toLowerCase().includes(q);
        if (!matchTitle && !matchDetails && !matchLocation && !matchSource) return false;
      }
      return true;
    });
  }, [alerts, activeCity, filterPriority, filterIngestion, filterCategory, searchQuery]);

  const selectedItem = useMemo(() => {
    return filtered.find((a) => a.id === selectedAlertId) || null;
  }, [filtered, selectedAlertId]);

  // Handle one-click conversion to work order using backend database transaction
  async function handleConvert(alert: ProactiveAlert) {
    if (convertedIds[alert.id] || isConvertingId) return;
    setIsConvertingId(alert.id);
    
    try {
      const res = await convertProactiveAlert(alert.id);
      if (res && res.success) {
        setConvertedIds((prev) => ({ ...prev, [alert.id]: true }));
        // Re-fetch live data to update alerts list (converted alert is deleted from proactive table)
        await fetchAlerts(false);
        setSelectedAlertId(null);

        // Dispatch sync event so Tab 1 map & list update instantly
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("echo-storage-sync"));
        }

        // Hand off to the Management & Delegation tab where the new work order lands.
        onConverted?.();
      }
    } catch (err) {
      console.error("Failed to convert alert:", err);
    } finally {
      setIsConvertingId(null);
    }
  }

  // Crawl live civic news across ALL supported cities and refresh the feed.
  async function handleScanNews() {
    if (isScanning) return;
    setIsScanning(true);
    setScanMsg("Crawling live civic news across all supported cities…");
    try {
      const res = await ingestNews(); // no cityId → every configured city
      if (res.ingested > 0) {
        await fetchAlerts(false);
        setScanMsg(`Ingested ${res.ingested} new alert${res.ingested > 1 ? "s" : ""} across ${res.cities.length} cities (${res.scanned} articles scanned).`);
      } else {
        setScanMsg(`No new alerts — scanned ${res.scanned} articles across ${res.cities.length} cities.`);
      }
    } catch (err) {
      setScanMsg(err instanceof Error ? `Scan failed: ${err.message}` : "Scan failed.");
    } finally {
      setIsScanning(false);
      setTimeout(() => setScanMsg(null), 8000);
    }
  }

  // Initialize Google Map (async — the Maps JS API loads on demand).
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return; // key-free fallback renders instead (see below)

    let cancelled = false;
    const initCity = activeCity;
    const loader = new Loader({ apiKey, version: "weekly" });

    Promise.all([loader.importLibrary("maps"), loader.importLibrary("marker")])
      .then(([{ Map }, markerLib]) => {
        if (cancelled || !mapContainerRef.current) return;
        markerLibRef.current = markerLib;
        mapRef.current = new Map(mapContainerRef.current, {
          center: { lat: initCity.lat, lng: initCity.lng },
          zoom: initCity.zoom,
          mapId: MAP_ID,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        setMapReady(true);
      })
      .catch(() => {
        // e.g. bad key / WebGL unavailable — degrade to the key-free fallback view.
        if (!cancelled) setMapError(true);
      });

    return () => {
      cancelled = true;
      Object.values(markersRef.current).forEach((m) => (m.map = null));
      markersRef.current = {};
      mapRef.current = null;
      markerLibRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map markers when filtered items change
  useEffect(() => {
    const map = mapRef.current;
    const markerLib = markerLibRef.current;
    if (!map || !markerLib) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach((m) => (m.map = null));
    markersRef.current = {};

    const { AdvancedMarkerElement } = markerLib;
    filtered.forEach((item) => {
      const el = document.createElement("button");
      el.setAttribute("aria-label", item.title);
      const isSelected = selectedAlertId === item.id;
      const isCritical = item.priority === "Critical";
      const isWarning = item.priority === "Warning";
      const bgColor = isCritical ? "#DC2626" : isWarning ? "#D97706" : "#2563EB";
      const ringColor = isCritical ? "rgba(220, 38, 38, 0.4)" : isWarning ? "rgba(217, 119, 6, 0.4)" : "rgba(37, 99, 235, 0.4)";

      el.style.width = isSelected ? "36px" : "30px";
      el.style.height = isSelected ? "36px" : "30px";
      el.style.borderRadius = "50%";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontFamily = "var(--font-display), sans-serif";
      el.style.fontWeight = "800";
      el.style.fontSize = isSelected ? "15px" : "13px";
      el.style.color = "white";
      el.style.border = isSelected ? "3px solid #FFF" : "2px solid white";
      el.style.cursor = "pointer";
      el.style.boxShadow = isSelected
        ? `0 4px 12px rgba(0,0,0,0.4), 0 0 0 4px ${ringColor}`
        : "0 2px 6px rgba(0,0,0,0.25)";
      el.style.transition = "all 0.2s ease";
      el.style.backgroundColor = bgColor;
      el.style.zIndex = isSelected ? "10" : "1";
      // AdvancedMarkerElement anchors content bottom-center; nudge down half its
      // height so the badge centers on the coordinate (like Mapbox did).
      el.style.transform = "translateY(50%)";

      el.textContent = isCritical ? "⚠" : isWarning ? "⚡" : "ℹ";

      el.onclick = () => {
        setSelectedAlertId(item.id);
      };

      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: item.geo.lat, lng: item.geo.lng },
        content: el,
        zIndex: isSelected ? 10 : 1,
      });

      markersRef.current[item.id] = marker;
    });
  }, [filtered, selectedAlertId, mapReady]);

  // Fly to selected alert when clicked
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedAlertId) return;
    const item = alerts.find((a) => a.id === selectedAlertId);
    if (!item) return;

    map.panTo({ lat: item.geo.lat, lng: item.geo.lng });
    map.setZoom(14.5);
  }, [selectedAlertId, alerts, mapReady]);

  // Fly to the selected city (from the dashboard header) and reset any selection.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedAlertId(null);
    const map = mapRef.current;
    if (!map) return;
    map.panTo({ lat: activeCity.lat, lng: activeCity.lng });
    map.setZoom(activeCity.zoom);
  }, [activeCity]);

  function getPriorityBadge(priority: ProactivePriorityLevel) {
    switch (priority) {
      case "Critical":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 shadow-2xs">
            <AlertTriangle size={12} />
            <span>CRITICAL</span>
          </span>
        );
      case "Warning":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
            <ShieldAlert size={12} />
            <span>WARNING</span>
          </span>
        );
      case "Monitor":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
            <Clock size={12} />
            <span>MONITOR</span>
          </span>
        );
    }
  }

  function getIngestionBadge(type: IngestionType) {
    switch (type) {
      case "SCADA Telemetry":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <Activity size={12} className="text-emerald-600" />
            SCADA Telemetry
          </span>
        );
      case "Computer Vision (CV)":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
            <Zap size={12} className="text-purple-600" />
            Computer Vision
          </span>
        );
      case "News Feeds (NLP)":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
            <Radio size={12} className="text-blue-600" />
            News Feeds (NLP)
          </span>
        );
    }
  }

  return (
    <div className="space-y-6 animate-[fadeSlideIn_200ms_ease-out] relative">
      {isFetching && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-35">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-3 border-civic-500 border-t-transparent animate-spin" />
            <span className="text-xs font-semibold text-surface-700">Loading telemetry data...</span>
          </div>
        </div>
      )}

      {/* Control Center Header & Telemetry Status Banner */}
      <div className="bg-white rounded-2xl p-6 border border-surface-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold shadow-2xs">
              <Cpu size={14} className="animate-pulse text-emerald-600" />
              <span>AI TELEMETRY &amp; INGESTION PIPELINES ACTIVE</span>
            </div>
            <span className="text-xs font-medium text-surface-500 bg-surface-100 px-2.5 py-0.5 rounded-full border border-surface-200">
              {filtered.length} Proactive Alerts Detected
            </span>
          </div>
          <h2 className="font-display font-bold text-2xl text-surface-900 tracking-tight">
            Proactive Area Infrastructure Analysis
          </h2>
          <p className="text-sm text-surface-700 leading-relaxed font-medium">
            Continuously aggregating local news NLP feeds, municipal drain camera computer vision (CV), and water-board SCADA telemetry to predictively identify and remediate infrastructure failures before citizen complaints occur.
          </p>
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
          <button
            type="button"
            onClick={handleScanNews}
            disabled={isScanning}
            title="Crawl live civic news across all supported cities"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-civic-600 text-white text-xs font-display font-bold shadow-sm hover:bg-civic-700 active:scale-95 transition-all disabled:opacity-60"
          >
            {isScanning ? <Loader2 size={15} className="animate-spin" /> : <Newspaper size={15} />}
            <span>{isScanning ? "Scanning all cities…" : "Scan Live News"}</span>
          </button>
          {scanMsg && (
            <span className="text-[11px] font-semibold text-surface-600 max-w-[260px] text-right leading-snug">
              {scanMsg}
            </span>
          )}
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white rounded-2xl p-4 border border-surface-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-surface-700 mr-1">
            <Filter size={14} className="text-civic-600" />
            <span>Filter Telemetry:</span>
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-1 bg-surface-100 p-1 rounded-lg border border-surface-200">
            <span className="text-[10px] font-bold uppercase px-2 text-surface-500">Priority:</span>
            {["All", "Critical", "Warning", "Monitor"].map((p) => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                className={clsx(
                  "px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                  filterPriority === p
                    ? "bg-white text-surface-900 shadow-2xs border border-surface-200/80"
                    : "text-surface-600 hover:text-surface-900"
                )}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Ingestion Type filter */}
          <div className="flex items-center gap-1 bg-surface-100 p-1 rounded-lg border border-surface-200">
            <span className="text-[10px] font-bold uppercase px-2 text-surface-500">Source Type:</span>
            {["All", "SCADA Telemetry", "Computer Vision (CV)", "News Feeds (NLP)"].map((type) => (
              <button
                key={type}
                onClick={() => setFilterIngestion(type)}
                className={clsx(
                  "px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                  filterIngestion === type
                    ? "bg-white text-surface-900 shadow-2xs border border-surface-200/80"
                    : "text-surface-600 hover:text-surface-900"
                )}
              >
                {type === "Computer Vision (CV)" ? "CV Feed" : type === "News Feeds (NLP)" ? "NLP News" : type === "SCADA Telemetry" ? "SCADA" : "All"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Category Dropdown */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-surface-200 bg-surface-50 text-xs font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-civic-500"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "All" ? "All Departments & Categories" : cat}
              </option>
            ))}
          </select>

          {/* Search box */}
          <div className="relative min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search alert, sensor, location..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-surface-200 bg-surface-50 text-xs font-medium text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-civic-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Side-by-Side Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-6 min-h-[660px]">
        {/* Left Hand Side Panel */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm flex flex-col overflow-hidden h-[660px]">
          {selectedItem ? (
            <div className="flex flex-col h-full animate-[fadeSlideIn_150ms_ease-out]">
              {/* Header Navigation Bar */}
              <div className="px-5 py-3.5 border-b border-surface-200 bg-surface-50/80 flex items-center justify-between shrink-0">
                <button
                  onClick={() => setSelectedAlertId(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-surface-700 hover:text-civic-600 transition-colors bg-white px-3 py-1 rounded-lg border border-surface-205 shadow-2xs"
                >
                  <ArrowLeft size={14} />
                  <span>Back to all alerts ({filtered.length})</span>
                </button>
                <span className="text-xs font-mono font-bold text-surface-500 bg-surface-100 px-2 py-0.5 rounded border border-surface-200">
                  ID: {selectedItem.id}
                </span>
              </div>

              {/* Scrollable Detailed Description Area */}
              <div className="overflow-y-auto p-6 space-y-5 flex-1 min-h-0">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {getPriorityBadge(selectedItem.priority)}
                    {getIngestionBadge(selectedItem.ingestion_type)}
                    <span
                      title={selectedItem.source_tooltip}
                      className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-surface-700 bg-surface-100 px-2 py-0.5 rounded border border-surface-200"
                    >
                      ℹ {selectedItem.source_tooltip}
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-xl text-surface-900 leading-snug">
                    {selectedItem.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <CategoryBadge category={selectedItem.category} />
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-surface-700 bg-surface-100 px-2.5 py-0.5 rounded-full border border-surface-200">
                      <MapPin size={13} className="text-civic-600" />
                      {selectedItem.location_label}
                    </span>
                    <span className="text-xs text-surface-400 font-medium ml-auto">
                      {selectedItem.timestamp}
                    </span>
                  </div>
                </div>

                {/* Scraped Telemetry Findings */}
                <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-surface-500 block">
                    Scraped Telemetry Findings:
                  </span>
                  <p className="text-xs sm:text-sm text-surface-800 leading-relaxed font-medium">
                    {selectedItem.details}
                  </p>
                </div>

                {/* Recommended AI Remediation Action */}
                <div className="bg-civic-50/60 p-4 rounded-xl border border-civic-200 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-civic-900 flex items-center gap-1.5">
                    <ArrowUpRight size={14} className="text-civic-600" />
                    Recommended AI Remediation Action:
                  </span>
                  <p className="text-xs sm:text-sm text-civic-950 font-bold leading-relaxed">
                    {selectedItem.suggested_action}
                  </p>
                  <p className="text-xs text-civic-800 pt-2 border-t border-civic-200/60">
                    Target Municipal Agency: <span className="font-bold">{selectedItem.department}</span>
                  </p>
                </div>
              </div>

              {/* Footer Action Area */}
              <div className="p-5 border-t border-surface-200 bg-surface-50/60 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="hidden sm:block">
                  <span className="block text-[10px] font-bold uppercase text-surface-400">Status</span>
                  <span className="text-xs font-bold text-surface-700">
                    {convertedIds[selectedItem.id] ? "✓ Actionable Work Order" : "⚡ Unconverted Alert"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleConvert(selectedItem)}
                  disabled={convertedIds[selectedItem.id] || isConvertingId === selectedItem.id}
                  className={clsx(
                    "px-5 py-3 rounded-xl font-display font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm shrink-0 min-w-[200px]",
                    convertedIds[selectedItem.id]
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default animate-none"
                      : "bg-purple-600 text-white hover:bg-purple-705 active:scale-95 shadow-md"
                  )}
                >
                  {isConvertingId === selectedItem.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : convertedIds[selectedItem.id] ? (
                    <>
                      <CheckCircle size={15} className="text-emerald-600" />
                      <span>Converted to Work Order</span>
                    </>
                  ) : (
                    <>
                      <Zap size={15} />
                      <span>Convert to Actionable Work Order</span>
                      <ArrowUpRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="px-5 py-3.5 border-b border-surface-200 bg-surface-50/70 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                  <h3 className="font-display font-bold text-sm text-surface-900">
                    Detected Infrastructure Alerts
                  </h3>
                  <span className="text-xs font-bold text-surface-600 bg-white px-2 py-0.5 rounded-full border border-surface-200">
                    {filtered.length}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-surface-500">
                  Select to inspect
                </span>
              </div>

              <div className="overflow-y-auto divide-y divide-surface-100 flex-1 min-h-0 animate-[fadeSlideIn_150ms_ease-out]">
                {filtered.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <p className="text-surface-500 text-sm font-medium">
                      No telemetry alerts match your current filter criteria.
                    </p>
                  </div>
                ) : (
                  filtered.map((item) => {
                    const isConverted = convertedIds[item.id];
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedAlertId(item.id)}
                        className="p-5 transition-all cursor-pointer hover:bg-surface-50 group"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {getPriorityBadge(item.priority)}
                            {getIngestionBadge(item.ingestion_type)}
                          </div>
                          <span className="text-[11px] font-mono font-semibold text-surface-400">
                            {item.timestamp}
                          </span>
                        </div>

                        <h4 className="font-display font-bold text-base text-surface-900 leading-snug group-hover:text-civic-600 transition-colors mb-2">
                          {item.title}
                        </h4>

                        <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-surface-100">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-surface-700 truncate max-w-[220px]">
                            <MapPin size={13} className="text-civic-600 shrink-0" />
                            <span className="truncate">{item.location_label}</span>
                          </span>
                          <span
                            className={clsx(
                              "text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 border transition-all shadow-3xs",
                              isConverted
                                ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                                : "text-civic-600 bg-civic-50 border-civic-200 group-hover:bg-civic-100"
                            )}
                          >
                            {isConverted ? "✓ Work Order" : "Inspect Details →"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Real-Time Telemetry Google Map */}
        <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden shadow-sm flex flex-col h-[660px]">
          <div className="px-5 py-3 border-b border-surface-200 flex items-center justify-between bg-surface-50/50 shrink-0">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-civic-600" />
              <h3 className="font-display font-bold text-sm text-surface-900">
                {activeCity.name} Real-Time Telemetry Map
              </h3>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-bold text-surface-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block border border-red-800"></span>
                <span>Critical</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block border border-amber-800"></span>
                <span>Warning</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block border border-blue-800"></span>
                <span>Monitor</span>
              </div>
            </div>
          </div>
          {!showFallbackMap ? (
            <div ref={mapContainerRef} className="w-full flex-1 min-h-0" />
          ) : (
            <div className="relative w-full flex-1 min-h-0 overflow-hidden bg-[radial-gradient(circle_at_30%_25%,rgba(79,70,229,0.10),transparent_35%),linear-gradient(135deg,#0F172A,#020617)]">
              <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:40px_40px]" />
              {filtered.map((item) => {
                const p = projectLocalPoint(item.geo.lat, item.geo.lng, activeCity);
                const isSel = selectedAlertId === item.id;
                const color =
                  item.priority === "Critical" ? "#DC2626" : item.priority === "Warning" ? "#D97706" : "#2563EB";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedAlertId(item.id)}
                    title={item.title}
                    className="absolute flex items-center justify-center rounded-full border-2 border-white text-white font-bold shadow-lg transition-transform hover:scale-110"
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      width: isSel ? 34 : 26,
                      height: isSel ? 34 : 26,
                      fontSize: isSel ? 15 : 12,
                      transform: "translate(-50%, -50%)",
                      backgroundColor: color,
                      zIndex: isSel ? 10 : 1,
                      boxShadow: isSel ? `0 0 0 4px ${color}44` : "0 2px 6px rgba(0,0,0,.35)",
                    }}
                  >
                    {item.priority === "Critical" ? "⚠" : item.priority === "Warning" ? "⚡" : "ℹ"}
                  </button>
                );
              })}
              <div className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-ink-950/80 px-3 py-1.5 text-[10px] font-semibold text-white/60 backdrop-blur">
                Live telemetry positions &middot; {filtered.length} alerts &middot; add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for the interactive map
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
