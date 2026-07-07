"use client";

import { useState } from "react";
import Link from "next/link";
import SubmissionForm from "@/components/submission/SubmissionForm";
import CitizenComplaintList from "@/components/dashboard/CitizenComplaintList";
import PageTranslator from "@/components/citizen/PageTranslator";
import { PlusCircle, ListTodo, ShieldAlert, ArrowLeft, Landmark, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { CITIES } from "@/lib/cities";

export default function CitizenDashboardPage() {
  const [activeTab, setActiveTab] = useState<"submit" | "track">("submit");
  const [selectedCityId, setSelectedCityId] = useState<string>("bengaluru");

  return (
    <div id="citizen-root" className="min-h-screen mesh-bg flex flex-col text-surface-900">
      {/* ── Header / Navigation Gate ── */}
      <header className="glass-nav px-6 py-4 border-b border-white/40 shrink-0 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
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
                  Citizen Portal
                </p>
              </div>
            </Link>

            <div className="h-8 w-px bg-surface-200 hidden sm:block" />

            {/* City Selector Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="city-select-citizen" className="text-xs font-semibold text-surface-700 uppercase tracking-wider">
                City:
              </label>
              <select
                id="city-select-citizen"
                value={selectedCityId}
                onChange={(e) => setSelectedCityId(e.target.value)}
                className="text-sm font-medium bg-white/50 border border-surface-200 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-civic-500/50"
              >
                {CITIES.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PageTranslator />
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-surface-100 hover:bg-surface-200 border border-surface-200 text-xs font-semibold text-surface-900 transition-colors shadow-sm"
            >
              <Landmark size={14} className="text-amber-600" />
              <span>Switch to MP Dashboard →</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Container with Two-Tab Switcher ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-8 pb-28">
        {/* Tab Selector Bar */}
        <div className="flex rounded-2xl glass-panel p-1.5 mb-8 max-w-md mx-auto shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab("submit")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-display font-semibold text-sm transition-all duration-300",
              activeTab === "submit"
                ? "bg-white text-civic-600 shadow-md shadow-civic-500/10 scale-100"
                : "text-surface-700 hover:text-surface-900 hover:bg-white/50 scale-95"
            )}
            id="tab-submit-complaint"
          >
            <PlusCircle size={16} />
            <span>1. Submit Complaint</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("track")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-display font-semibold text-sm transition-all duration-300",
              activeTab === "track"
                ? "bg-white text-civic-600 shadow-md shadow-civic-500/10 scale-100"
                : "text-surface-700 hover:text-surface-900 hover:bg-white/50 scale-95"
            )}
            id="tab-my-complaints"
          >
            <ListTodo size={16} />
            <span>2. My Complaints</span>
          </button>
        </div>

        {/* Tab 1: Submit Complaint */}
        {activeTab === "submit" && (
          <div className="glass-panel rounded-3xl shadow-glass p-6 sm:p-10 animate-slide-up-fade">
            <div className="mb-8 pb-6 border-b border-surface-200/50 text-center sm:text-left">
              <h2 className="font-display font-extrabold text-2xl text-surface-900">
                Report a Neighborhood Need
              </h2>
              <p className="text-sm text-surface-700 mt-1">
                Your report will be automatically routed to the correct department in {CITIES.find(c => c.id === selectedCityId)?.name || 'your city'}.
              </p>
            </div>

            <SubmissionForm selectedCityId={selectedCityId} />
          </div>
        )}

        {/* Tab 2: My Complaints Tracker */}
        {activeTab === "track" && (
          <div className="animate-slide-up-fade">
            <CitizenComplaintList />
          </div>
        )}
      </main>
    </div>
  );
}
