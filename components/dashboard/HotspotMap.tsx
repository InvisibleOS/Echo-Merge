"use client";

import { useEffect, useRef } from "react";
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

    priorities.forEach((item) => {
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

  if (!hasMapboxToken) {
    return (
      <div className="w-full h-full min-h-[520px] rounded-lg overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(245,158,11,0.16),transparent_32%),linear-gradient(135deg,#111827,#020617)] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-white">Hotspot Map</h2>
            <p className="text-xs text-white/50 mt-1">
              Local demo view. Add <span className="font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</span> for live Mapbox tiles.
            </p>
          </div>
          <span className="rounded-full bg-signal-amber/15 px-3 py-1 text-xs font-semibold text-signal-amber">
            {hotspots.length} signals
          </span>
        </div>

        <div className="relative mt-4 h-[calc(100%-76px)] min-h-[420px] rounded-md border border-white/10 bg-white/[0.04] overflow-hidden">
          <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:44px_44px]" />
          {priorities.slice(0, 14).map((item, index) => {
            const left = 12 + ((index * 23) % 76);
            const top = 14 + ((index * 31) % 70);
            return (
              <button
                key={item.work_id}
                type="button"
                onClick={() => onSelectMarker(item.work_id)}
                className={
                  item.work_id === selectedId
                    ? "absolute z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-signal-amber text-xs font-bold text-white shadow-lg"
                    : "absolute z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-civic-500 text-xs font-bold text-white shadow-lg hover:bg-signal-amber"
                }
                style={{ left: `${left}%`, top: `${top}%` }}
                aria-label={item.title}
              >
                {item.rank}
              </button>
            );
          })}

          <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-ink-950/80 p-3 backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">
              Top Visible Hotspots
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {priorities.slice(0, 4).map((item) => (
                <button
                  key={item.work_id}
                  type="button"
                  onClick={() => onSelectMarker(item.work_id)}
                  className="rounded bg-white/[0.06] px-3 py-2 text-left text-xs text-white/80 hover:bg-white/[0.1]"
                >
                  <span className="font-semibold text-white">#{item.rank}</span>{" "}
                  {item.category}
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
