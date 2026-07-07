"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Hotspot, PriorityItem } from "@/lib/types";

interface Props {
  hotspots: Hotspot[];
  priorities: PriorityItem[];
  selectedId: string | null;
  onSelectMarker: (workId: string) => void;
}

// Bengaluru South — center of the real submissions in
// day1_enriched_submissions.json (Person 4's Day 1 data drop).
// Update if the team locks a different demo constituency.
const DEFAULT_CENTER: [number, number] = [77.5952, 12.9071];
const INDIA_BOUNDS = {
  minLat: 6,
  maxLat: 36,
  minLng: 68,
  maxLng: 90,
};

export default function HotspotMap({
  hotspots,
  priorities,
  selectedId,
  onSelectMarker,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Record<string, mapboxgl.Marker>>({});
  const hasMapboxToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  const fallbackClusters = useMemo(() => getConstituencyClusters(hotspots), [hotspots]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: DEFAULT_CENTER,
      zoom: 12,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("hotspots", {
        type: "geojson",
        data: hotspotsToGeoJSON(hotspots),
      });

      map.addLayer({
        id: "hotspot-heat",
        type: "heatmap",
        source: "hotspots",
        maxzoom: 16,
        paint: {
          "heatmap-weight": ["get", "intensity"],
          "heatmap-intensity": 1.2,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(79,70,229,0)",
            0.3,
            "#818CF8",
            0.6,
            "#4F46E5",
            1,
            "#F59E0B",
          ],
          "heatmap-radius": 40,
          "heatmap-opacity": 0.75,
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update heatmap source when hotspots change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("hotspots")) return;
    (map.getSource("hotspots") as mapboxgl.GeoJSONSource).setData(
      hotspotsToGeoJSON(hotspots)
    );
  }, [hotspots]);

  // Render numbered markers for each priority, on top of the heatmap
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

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
      el.style.background =
        item.work_id === selectedId ? "#F59E0B" : "#4F46E5";
      el.textContent = String(item.rank);
      el.onclick = () => onSelectMarker(item.work_id);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([item.hotspot_geo.lng, item.hotspot_geo.lat])
        .addTo(map);

      markersRef.current[item.work_id] = marker;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorities, selectedId]);

  // Fly to selected priority
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const item = priorities.find((p) => p.work_id === selectedId);
    if (!item) return;
    map.flyTo({
      center: [item.hotspot_geo.lng, item.hotspot_geo.lat],
      zoom: 14,
      duration: 800,
    });
  }, [selectedId, priorities]);

  // Token-free fallback: a lightweight India heatmap so complaints still render
  // (numbered priority pins + demand glow) when NEXT_PUBLIC_MAPBOX_TOKEN is unset.
  if (!hasMapboxToken) {
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
              <span className="text-[10px] font-semibold text-white/40">Mapbox optional</span>
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

function hotspotsToGeoJSON(hotspots: Hotspot[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: hotspots.map((h) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [h.geo.lng, h.geo.lat] },
      properties: {
        intensity: h.intensity,
        category: h.category,
        demand_count: h.demand_count,
      },
    })),
  };
}
