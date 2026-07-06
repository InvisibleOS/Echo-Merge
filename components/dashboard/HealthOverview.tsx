"use client";

import { ConstituencyHealth } from "@/lib/types";
import { Activity, AlertTriangle, CheckCircle2, Gauge, MapPinned, ShieldCheck } from "lucide-react";

interface Props {
  health: ConstituencyHealth | null;
  isLoading: boolean;
}

export default function HealthOverview({ health, isLoading }: Props) {
  const cards = [
    {
      label: "Health Index",
      value: health ? `${health.health_index}/100` : "--",
      sub: health?.trend_label || "Loading signal",
      icon: Gauge,
      tone: "text-civic-300",
    },
    {
      label: "Open Cases",
      value: health ? health.open_cases : "--",
      sub: `${health?.critical_cases ?? 0} critical`,
      icon: AlertTriangle,
      tone: "text-signal-amber",
    },
    {
      label: "SLA Breaches",
      value: health ? health.sla_breaches : "--",
      sub: health?.slowest_department || "Department watch",
      icon: Activity,
      tone: "text-red-300",
    },
    {
      label: "Trust Score",
      value: health ? `${health.citizen_trust_score}/100` : "--",
      sub: `${health?.resolved_this_week ?? 0} resolved this week`,
      icon: ShieldCheck,
      tone: "text-emerald-300",
    },
    {
      label: "Hotspots",
      value: health ? health.active_hotspots : "--",
      sub: health?.top_issue || "No dominant issue",
      icon: MapPinned,
      tone: "text-sky-300",
    },
    {
      label: "Fastest Team",
      value: health?.fastest_department ? "Active" : "--",
      sub: health?.fastest_department || "Waiting",
      icon: CheckCircle2,
      tone: "text-lime-300",
    },
  ];

  return (
    <section className="grid grid-cols-2 xl:grid-cols-6 gap-3">
      {cards.map(({ label, value, sub, icon: Icon, tone }) => (
        <div key={label} className="rounded-lg border border-white/10 bg-white/[0.06] p-3 min-h-[96px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
              {label}
            </span>
            <Icon size={16} className={tone} />
          </div>
          <div className="mt-3 text-2xl font-display font-bold text-white leading-none">
            {isLoading ? "..." : value}
          </div>
          <p className="mt-2 text-xs text-white/55 leading-snug line-clamp-2">{sub}</p>
        </div>
      ))}
    </section>
  );
}
