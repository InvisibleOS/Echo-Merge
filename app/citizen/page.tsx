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
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-body">
      {/* ── Header / Navigation Gate ── */}
      <header className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-surface-150 shrink-0 sticky top-0 z-50 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <Link
              href="/"
              className="text-surface-600 hover:text-surface-900 transition-colors p-1.5 hover:bg-surface-100 rounded-lg"
              title="Back to Landing Gate"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="w-9 h-9 rounded-xl bg-civic-500/10 border border-civic-500/20 flex items-center justify-center text-civic-600 shadow-3xs">
              <ShieldAlert size={18} />
            </div>
            <div>
              <span className="text-civic-600 font-display font-extrabold text-[9px] uppercase tracking-widest block">
                Citizen Portal &bull; Constituency Action
              </span>
              <h1 className="font-display font-extrabold text-base text-surface-950 leading-tight">
                Neighborhood Need Intake &amp; Tracking
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 border border-surface-200 text-xs font-display font-bold text-surface-800 transition-colors shadow-2xs"
            >
              <Landmark size={13} className="text-amber-500" />
              <span>Representative Dashboard →</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Container with Two-Tab Switcher ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10">
        {/* Tab Selector Bar */}
        <div className="flex rounded-xl bg-surface-200/50 p-1.5 border border-surface-200/60 mb-10 max-w-sm mx-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("submit")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-display font-bold text-xs sm:text-sm transition-all duration-200 active:scale-97",
              activeTab === "submit"
                ? "bg-civic-500 text-white shadow-md shadow-civic-500/10"
                : "text-surface-700 hover:text-surface-900 hover:bg-white/60"
            )}
            id="tab-submit-complaint"
          >
            <PlusCircle size={15} />
            <span>Submit Report</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("track")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-display font-bold text-xs sm:text-sm transition-all duration-200 active:scale-97",
              activeTab === "track"
                ? "bg-civic-500 text-white shadow-md shadow-civic-500/10"
                : "text-surface-700 hover:text-surface-900 hover:bg-white/60"
            )}
            id="tab-my-complaints"
          >
            <ListTodo size={15} />
            <span>My Grievances</span>
          </button>
        </div>

        {/* Tab 1: Submit Complaint */}
        {activeTab === "submit" && (
          <div className="bg-white rounded-3xl border border-surface-200/80 shadow-md p-6 sm:p-10 animate-[fadeSlideIn_200ms_ease-out]">
            <div className="mb-8 pb-5 border-b border-surface-150 text-center sm:text-left">
              <h2 className="font-display font-extrabold text-xl text-surface-950">
                Report a Neighborhood Need
              </h2>
              <p className="text-xs sm:text-sm text-surface-600 mt-1.5 font-medium leading-relaxed">
                Provide text description, record voice transcripts, or snap photos. Our AI maps, groups, and assigns your report directly to the responsible municipal department.
              </p>
            </div>

            <SubmissionForm />
          </div>
        )}

        {/* Tab 2: My Complaints Tracker */}
        {activeTab === "track" && (
          <div className="animate-[fadeSlideIn_200ms_ease-out]">
            <CitizenComplaintList />
          </div>
        )}
      </main>
    </div>
  );
}
