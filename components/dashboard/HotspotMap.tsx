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

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error(
        "Missing NEXT_PUBLIC_MAPBOX_TOKEN — get one free at account.mapbox.com"
      );
      return;
    }
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
