"use client";

import { useState } from "react";
import Link from "next/link";
import SubmissionForm from "@/components/submission/SubmissionForm";
import CitizenComplaintList from "@/components/dashboard/CitizenComplaintList";
import { PlusCircle, ListTodo, ShieldAlert, ArrowLeft, Landmark } from "lucide-react";
import clsx from "clsx";

export default function CitizenDashboardPage() {
  const [activeTab, setActiveTab] = useState<"submit" | "track">("submit");

  return (
    <div className="min-h-screen mesh-bg flex flex-col text-surface-900">
      {/* ── Header / Navigation Gate ── */}
      <header className="glass-nav px-6 py-4 border-b border-white/40 shrink-0 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-surface-700 hover:text-surface-900 transition-colors"
              title="Back to Landing Gate"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="w-8 h-8 rounded-lg bg-civic-50 border border-civic-200 flex items-center justify-center text-civic-600 shadow-sm">
              <ShieldAlert size={18} />
            </div>
            <div>
              <span className="text-civic-600 font-display font-semibold text-[10px] uppercase tracking-wider block">
                People&rsquo;s Priorities &bull; Citizen Control Gate
              </span>
              <h1 className="font-display font-bold text-lg text-surface-900 leading-tight">
                Citizen Reporting &amp; Live Tracking Portal
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
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
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
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
                Your submission is analyzed by AI and routed directly to the representative and agency responsible.
              </p>
            </div>

            <SubmissionForm />
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
