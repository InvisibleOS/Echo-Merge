"use client";

import { useState } from "react";
import { PriorityItem } from "@/lib/types";
import { updateCaseStatus } from "@/lib/api";
import { CategoryBadge } from "@/components/ui/Badge";
import {
  X,
  Users,
  MapPin,
  CheckCircle2,
  Building2,
  Clock,
  Wand2,
} from "lucide-react";
import clsx from "clsx";

interface Props {
  item: PriorityItem;
  onClose: () => void;
  onResolve: (workId: string) => void;
}

const DEPARTMENTS_LIST = [
  { id: "dept-pwd", name: "Public Works Department (PWD)" },
  { id: "dept-water", name: "Water Supply and Sewerage Board (BWSSB)" },
  { id: "dept-solid-waste", name: "Solid Waste Management Cell (SWM)" },
  { id: "dept-electricity", name: "Electricity and Streetlight (BESCOM)" },
  { id: "dept-safety", name: "Public Safety and Police Liaison" },
];

export default function DrillDownPanel({ item, onClose, onResolve }: Props) {
  const [isResolving, setIsResolving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Resolve case ID (e.g. CASE-aac117fd)
  const caseId = item.case_id || (item.work_id.startsWith("PRO_") 
    ? `CASE-${item.work_id.substring(4)}`
    : `CASE-${item.work_id.substring(12, 20)}`);

  const initialDeptId = typeof item.assigned_department === "string" 
    ? item.assigned_department 
    : item.department?.id || DEPARTMENTS_LIST[0].id;
  
  const [selectedDeptId, setSelectedDeptId] = useState(initialDeptId);
  const [activeReasoning, setActiveReasoning] = useState<'demand' | 'urgency' | 'equity' | 'validation' | null>(null);

  const isResolved = item.status === "Resolved";
  const isAssigned = item.status === "Assigned";

  async function handleResolve() {
    if (isResolving || isResolved) return;
    setIsResolving(true);
    try {
      const updated = await updateCaseStatus(caseId, "Resolved", "Marked as resolved by MP dashboard.", selectedDeptId);
      if (updated) {
        onResolve(item.work_id);
      }
    } catch (err) {
      console.error("Resolve failed:", err);
    } finally {
      setIsResolving(false);
    }
  }

  async function handleAssign() {
    if (isAssigning || isResolved) return;
    setIsAssigning(true);
    try {
      const updated = await updateCaseStatus(caseId, "Assigned", "Assigned to department for execution.", selectedDeptId);
      if (updated) {
        onResolve(item.work_id);
      }
    } catch (err) {
      console.error("Assignment failed:", err);
    } finally {
      setIsAssigning(false);
    }
  }

  return (
    <div className="bg-white p-6 h-full flex flex-col justify-between">
      <div className="space-y-6">
        {/* Header Title section */}
        <div className="flex items-start justify-between gap-4 border-b border-surface-150 pb-4">
          <div>
            <span className="text-[10px] font-bold text-civic-600 uppercase tracking-widest bg-civic-50 px-2 py-0.5 rounded border border-civic-200">
              Ticket: {caseId}
            </span>
            <h2 className="font-display font-bold text-xl text-surface-900 mt-2 leading-snug">
              {item.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-surface-900 shrink-0 p-1.5 rounded-lg hover:bg-surface-100 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Badges metadata grid */}
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={item.category} />
          <span
            className={clsx(
              "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border shadow-3xs",
              isResolved
                ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                : isAssigned
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            )}
          >
            {isResolved ? (
              <>
                <CheckCircle2 size={12} /> Resolved
              </>
            ) : isAssigned ? (
              <>
                🏢 Assigned
              </>
            ) : (
              "Open / Pending"
            )}
          </span>
          {item.sla_status && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 font-semibold shadow-3xs">
              <Clock size={13} /> {item.sla_status}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-medium text-surface-700 bg-surface-100 px-2.5 py-0.5 rounded-full border border-surface-200 shadow-3xs">
            <Users size={13} /> {item.demand_count} signals
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-surface-700 bg-surface-100 px-2.5 py-0.5 rounded-full border border-surface-200 shadow-3xs">
            <MapPin size={13} />
            {item.hotspot_geo.lat.toFixed(4)}, {item.hotspot_geo.lng.toFixed(4)}
          </span>
        </div>

        {/* AI Resolution Brief Section */}
        {item.resolution_brief && (
          <div className="p-4 rounded-xl bg-civic-50/40 border border-civic-200/70 shadow-3xs">
            <h3 className="text-xs font-bold text-civic-700 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Wand2 size={14} /> AI Remediation Plan
            </h3>
            <p className="text-sm font-semibold text-surface-900 leading-snug">
              {item.resolution_brief.summary}
            </p>
            <p className="text-xs text-surface-700 mt-2 leading-relaxed font-medium">
              {item.resolution_brief.why_now}
            </p>
            <div className="mt-3.5 rounded-lg bg-white border border-civic-200 p-3 shadow-3xs">
              <span className="block text-[9px] uppercase font-bold text-surface-500 mb-0.5">
                First Action Step
              </span>
              <p className="text-xs text-surface-900 leading-relaxed font-medium">
                {item.resolution_brief.first_action}
              </p>
            </div>
          </div>
        )}

        {/* Explanation text block */}
        <p className="text-xs text-surface-700 leading-relaxed bg-surface-50 p-3 rounded-xl border border-surface-200/50 font-medium">
          {item.explanation}
        </p>

        {/* Management Controls Panel */}
        {!isResolved && (
          <div className="border-t border-surface-200 pt-5 space-y-4">
            <h3 className="text-xs font-bold text-surface-900 uppercase tracking-wider">
              Management &amp; Actions
            </h3>
            
            {/* Department Selection dropdown */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase text-surface-500">
                Assign Municipal Agency
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedDeptId}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="flex-1 bg-white text-surface-900 text-xs border border-surface-200 rounded-lg px-3 py-2 outline-none focus:border-civic-500 font-medium shadow-3xs"
                >
                  {DEPARTMENTS_LIST.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={isAssigning}
                  className="bg-civic-600 hover:bg-civic-750 text-white font-bold text-xs rounded-lg px-4 py-2 shadow-sm transition-all hover:scale-102 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center min-w-[100px]"
                >
                  {isAssigning ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Assign"
                  )}
                </button>
              </div>
            </div>

            {/* Resolve button */}
            <button
              type="button"
              onClick={handleResolve}
              disabled={isResolving}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs py-2.5 shadow-sm transition-all hover:scale-101 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isResolving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Mark as Resolved</span>
                </>
              )}
            </button>
          </div>
        )}

        {isResolved && (
          <div className="border-t border-surface-250 pt-5">
            <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-250 px-4 py-3 text-sm font-bold text-emerald-700 shadow-3xs">
              <CheckCircle2 size={16} />
              This ticket is fully resolved
            </div>
          </div>
        )}
      <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mt-6 mb-3">
        Supporting evidence ({item.supporting_evidence.length})
      </h3>

      <div className="space-y-3">
        {item.supporting_evidence.map((ev) => (
          <div
            key={ev.submission_id}
            className="border border-surface-200 rounded-xl p-4 shadow-3xs"
          >
            <span className="text-[11px] font-semibold text-surface-400 uppercase">
              {ev.language}
            </span>
            <p className="text-sm text-surface-900 mt-1 font-medium">{ev.raw_text}</p>

            {ev.language.toLowerCase() !== "english" && (
              <p className="text-sm text-surface-500 mt-2 pt-2 border-t border-surface-150 italic font-medium">
                &ldquo;{ev.normalized_text_en}&rdquo;
              </p>
            )}

            {(ev.geo || ev.canonical_location) && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-civic-700 font-semibold bg-civic-50 border border-civic-200 px-2.5 py-1 rounded-md w-fit shadow-3xs">
                <MapPin size={12} />
                {ev.canonical_location ||
                  (ev.geo && ev.geo.lat
                    ? `${ev.geo.lat.toFixed(4)}, ${ev.geo.lng.toFixed(4)}`
                    : "Location Attached")}
              </div>
            )}
            
            {ev.validation_context && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl shadow-3xs">
                <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[11px] uppercase mb-1.5 tracking-wider">
                  <span>🛡️ AI Validation Agent</span>
                </div>
                <p className="text-sm text-amber-900/90 whitespace-pre-line font-medium leading-relaxed">
                  {ev.validation_context}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
