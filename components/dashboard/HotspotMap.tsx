"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { Hotspot, PriorityItem } from "@/lib/types";
import { CityConfig } from "@/lib/cities";

interface Props {
  hotspots: Hotspot[];
  priorities: PriorityItem[];
  selectedId: string | null;
  onSelectMarker: (workId: string) => void;
  /** City (or the "All India" sentinel) to fly the map to. */
  focusCity?: CityConfig;
}

// Fallback center if no city is selected ({lat,lng} — Google Maps order).
const DEFAULT_CENTER = { lat: 12.9071, lng: 77.5952 };
const INDIA_BOUNDS = {
  minLat: 6,
  maxLat: 36,
  minLng: 68,
  maxLng: 90,
};

// AdvancedMarkerElement requires a Map ID. A cloud-styled id can be supplied via
// env; otherwise Google's built-in DEMO_MAP_ID renders fine for the demo.
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

const GLOW_BG =
  "radial-gradient(circle, rgba(245,158,11,.95) 0%, rgba(79,70,229,.5) 46%, rgba(79,70,229,0) 72%)";

export default function HotspotMap({
  hotspots,
  priorities,
  selectedId,
  onSelectMarker,
  focusCity,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerLibRef = useRef<google.maps.MarkerLibrary | null>(null);
  const markersRef = useRef<Record<string, google.maps.marker.AdvancedMarkerElement>>({});
  const heatMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const useFallback = !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || mapError;
  const fallbackClusters = useMemo(() => getConstituencyClusters(hotspots), [hotspots]);

  // Fly to the focused city — or zoom out to fit all of India in "All India" view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCity) return;
    map.panTo({ lat: focusCity.lat, lng: focusCity.lng });
    map.setZoom(focusCity.zoom);
  }, [focusCity, mapReady]);

  // Initialize map once (async — the Google Maps JS API loads on demand).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    let cancelled = false;
    const loader = new Loader({ apiKey, version: "weekly" });

    Promise.all([loader.importLibrary("maps"), loader.importLibrary("marker")])
      .then(([{ Map }, markerLib]) => {
        if (cancelled || !containerRef.current) return;
        markerLibRef.current = markerLib;

        const map = new Map(containerRef.current, {
          center: focusCity ? { lat: focusCity.lat, lng: focusCity.lng } : DEFAULT_CENTER,
          zoom: focusCity ? focusCity.zoom : 12,
          mapId: MAP_ID,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;
        setMapReady(true);
      })
      .catch(() => {
        // e.g. bad key / WebGL unavailable — degrade to the token-free fallback.
        if (!cancelled) setMapError(true);
      });

    return () => {
      cancelled = true;
      Object.values(markersRef.current).forEach((m) => (m.map = null));
      markersRef.current = {};
      heatMarkersRef.current.forEach((m) => (m.map = null));
      heatMarkersRef.current = [];
      mapRef.current = null;
      markerLibRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Heatmap: Google removed visualization.HeatmapLayer in Maps JS v3.65, so we
  // render the same intensity "glow" the fallback uses as low-z marker overlays.
  useEffect(() => {
    const map = mapRef.current;
    const markerLib = markerLibRef.current;
    if (!map || !markerLib) return;
    const { AdvancedMarkerElement } = markerLib;

    heatMarkersRef.current.forEach((m) => (m.map = null));
    heatMarkersRef.current = [];

    hotspots.slice(0, 300).forEach((h) => {
      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: h.geo.lat, lng: h.geo.lng },
        content: makeGlowEl(h.intensity),
        zIndex: 1,
      });
      heatMarkersRef.current.push(marker);
    });
  }, [hotspots, mapReady]);

  // Render numbered markers for each priority, on top of the heatmap
  useEffect(() => {
    const map = mapRef.current;
    const markerLib = markerLibRef.current;
    if (!map || !markerLib) return;

    // Clear old markers
    Object.values(markersRef.current).forEach((m) => (m.map = null));
    markersRef.current = {};

    const { AdvancedMarkerElement } = markerLib;
    priorities
      .filter((item) => item.status !== "Resolved")
      .forEach((item) => {
        const el = document.createElement("button");
        el.setAttribute("aria-label", item.title);
      el.style.width = "28px";
      el.style.height = "28px";
      el.style.borderRadius = "50%";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontFamily = "var(--font-display), sans-serif";
      el.style.fontWeight = "700";
      el.style.fontSize = "12px";
      el.style.color = "white";
      el.style.border = "2px solid white";
      el.style.cursor = "pointer";
      el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.25)";
      // AdvancedMarkerElement anchors content by its bottom-center; nudge down
      // half its height so the circle centers on the coordinate (like Mapbox).
      el.style.transform = "translateY(50%)";
      el.style.background =
        item.work_id === selectedId ? "#F59E0B" : "#4F46E5";
      el.textContent = String(item.rank);
      el.onclick = () => onSelectMarker(item.work_id);

      const marker = new AdvancedMarkerElement({
        map,
        position: { lat: item.hotspot_geo.lat, lng: item.hotspot_geo.lng },
        content: el,
        zIndex: 100,
      });

      markersRef.current[item.work_id] = marker;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorities, selectedId, mapReady]);

  // Fly to selected priority
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const item = priorities.find((p) => p.work_id === selectedId);
    if (!item) return;
    map.panTo({ lat: item.hotspot_geo.lat, lng: item.hotspot_geo.lng });
    map.setZoom(14);
  }, [selectedId, priorities, mapReady]);

  // Token-free fallback: a lightweight India heatmap so complaints still render
  // (numbered priority pins + demand glow) when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is unset.
  if (useFallback) {
    const openPriorities = priorities.filter((item) => item.status !== "Resolved");
    return (
      <div className="w-full h-full min-h-[520px] rounded-lg overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(245,158,11,0.16),transparent_32%),linear-gradient(135deg,#101827,#020617)] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-white">India Hotspot Heatmap</h2>
            <p className="text-xs text-white/50 mt-1">
              Nationwide demo signals from Bengaluru, Lucknow, Wayanad, New Delhi, and Mumbai South.
            </p>
          </div>
          <span className="rounded-full bg-signal-amber/15 px-3 py-1 text-xs font-semibold text-signal-amber">
            {hotspots.length} signals
          </span>
        </div>

        <div className="relative mt-4 h-[calc(100%-76px)] min-h-[420px] rounded-md border border-white/10 bg-white/[0.04] overflow-hidden">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:44px_44px]" />
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 120"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="indiaFallbackFill" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#1E293B" />
                <stop offset="100%" stopColor="#0F172A" />
              </linearGradient>
            </defs>
            <path
              d="M43 5 57 8 70 20 73 33 67 45 66 56 74 66 68 78 59 83 55 98 48 114 42 99 34 86 27 80 23 68 17 58 21 47 18 35 26 23 34 16Z"
              fill="url(#indiaFallbackFill)"
              stroke="rgba(255,255,255,.18)"
              strokeWidth="1.2"
            />
            <path
              d="M70 31 84 27 91 32 85 39 73 38Z"
              fill="#172033"
              stroke="rgba(255,255,255,.16)"
              strokeWidth="1"
            />
          </svg>

          {hotspots.slice(0, 250).map((item, index) => {
            const point = projectIndiaPoint(item.geo.lat, item.geo.lng);
            const size = Math.max(18, Math.min(44, 16 + item.intensity * 18));
            const opacity = Math.max(0.28, Math.min(0.78, 0.22 + item.intensity * 0.5));
            return (
              <span
                key={`${item.geo.lat}-${item.geo.lng}-${index}`}
                className="absolute rounded-full blur-md"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  opacity,
                  transform: "translate(-50%, -50%)",
                  background:
                    "radial-gradient(circle, rgba(245,158,11,.96) 0%, rgba(79,70,229,.56) 46%, rgba(79,70,229,0) 72%)",
                }}
              />
            );
          })}

          {openPriorities.slice(0, 18).map((item) => {
            const point = projectIndiaPoint(item.hotspot_geo.lat, item.hotspot_geo.lng);
            return (
              <button
                key={item.work_id}
                type="button"
                onClick={() => onSelectMarker(item.work_id)}
                className={
                  item.work_id === selectedId
                    ? "absolute z-20 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-signal-amber text-xs font-bold text-white shadow-lg"
                    : "absolute z-20 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-civic-500 text-xs font-bold text-white shadow-lg hover:bg-signal-amber"
                }
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
                aria-label={item.title}
              >
                {item.rank}
              </button>
            );
          })}

          <div className="absolute right-3 top-3 w-48 rounded-md border border-white/10 bg-ink-950/78 p-3 backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Constituency Signals</p>
            <div className="mt-2 space-y-2">
              {fallbackClusters.map((cluster) => (
                <div key={cluster.name} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-white/75">{cluster.name}</span>
                  <span className="rounded bg-white/10 px-2 py-0.5 font-semibold text-white">
                    {cluster.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-ink-950/82 p-3 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">
                Top National Priorities
              </p>
              <span className="text-[10px] font-semibold text-white/40">Google Maps optional</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {openPriorities.slice(0, 4).map((item) => (
                <button
                  key={item.work_id}
                  type="button"
                  onClick={() => onSelectMarker(item.work_id)}
                  className="rounded bg-white/[0.06] px-3 py-2 text-left text-xs text-white/80 hover:bg-white/[0.1]"
                >
                  <span className="font-semibold text-white">#{item.rank}</span>{" "}
                  {item.constituency || item.hotspot_geo.ward}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg overflow-hidden border border-ink-900/10"
    />
  );
}

// One blurred radial-gradient glow, sized/faded by hotspot intensity. Used as
// AdvancedMarkerElement content to approximate a density heatmap on the map.
function makeGlowEl(intensity: number) {
  const el = document.createElement("div");
  const size = Math.max(28, Math.min(96, 28 + intensity * 64));
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "50%";
  el.style.pointerEvents = "none";
  el.style.filter = "blur(7px)";
  el.style.transform = "translateY(50%)"; // center the glow on the coordinate
  el.style.opacity = String(Math.max(0.3, Math.min(0.8, 0.28 + intensity * 0.5)));
  el.style.background = GLOW_BG;
  return el;
}

function projectIndiaPoint(lat: number, lng: number) {
  const x =
    ((Number(lng) - INDIA_BOUNDS.minLng) /
      (INDIA_BOUNDS.maxLng - INDIA_BOUNDS.minLng)) *
    100;
  const y =
    (1 -
      (Number(lat) - INDIA_BOUNDS.minLat) /
        (INDIA_BOUNDS.maxLat - INDIA_BOUNDS.minLat)) *
    100;

  return {
    x: Math.max(7, Math.min(93, x)),
    y: Math.max(5, Math.min(96, y)),
  };
}

function getConstituencyClusters(hotspots: Hotspot[]) {
  const counts = new Map<string, number>();
  hotspots.forEach((item) => {
    const name = item.constituency || item.geo.ward || "Unknown";
    counts.set(name, (counts.get(name) || 0) + Math.max(1, item.demand_count || 1));
  });

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}
