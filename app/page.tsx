import Link from "next/link";
import { Users, Landmark, ArrowRight, ShieldCheck, Activity } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-surface-50 text-surface-900 relative overflow-hidden">
      {/* Subtle ambient gradient accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-civic-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-signal-amber/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl w-full flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-surface-200 shadow-sm text-surface-700 text-xs font-display font-semibold uppercase tracking-wider mb-6">
          <ShieldCheck size={14} className="text-civic-600" />
          <span>People&rsquo;s Priorities &bull; AI Proactive Urban Management</span>
        </div>

        <h1 className="font-display font-bold text-3xl sm:text-5xl tracking-tight text-surface-900 max-w-2xl leading-tight">
          Welcome to Your Civic Portal
        </h1>
        <p className="mt-4 text-surface-700/80 max-w-lg text-sm sm:text-base leading-relaxed">
          Select your portal to continue. Report neighborhood needs with voice, photo, or text, or manage constituency infrastructure in real-time.
        </p>

        {/* ── Two-Card Role Gate ── */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          {/* Citizen Card */}
          <Link
            href="/citizen"
            className="group relative flex flex-col justify-between rounded-2xl border border-surface-200 bg-white p-8 text-left transition-all duration-300 hover:border-civic-500/60 hover:shadow-lg hover:-translate-y-1"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-civic-50 border border-civic-200 flex items-center justify-center text-civic-600 mb-6 group-hover:scale-110 transition-transform shadow-sm">
                <Users size={24} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-civic-600">
                Citizen Portal
              </span>
              <h2 className="font-display font-bold text-2xl text-surface-900 mt-1">
                I am a Citizen
              </h2>
              <p className="text-sm text-surface-700 mt-3 leading-relaxed">
                Report local issues in your own language, attach photos or voice notes, and track departmental resolution in real-time.
              </p>

              <ul className="mt-6 space-y-2.5 text-xs text-surface-700/80 border-t border-surface-200 pt-6">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-civic-500" />
                  <span>Voice, photo & text submissions (BCP-47 multi-lingual)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-civic-500" />
                  <span>Live tracking of representative actions & status updates</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-civic-500" />
                  <span>Direct community evidence gathering</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4 flex items-center justify-between text-sm font-display font-semibold text-civic-600 group-hover:text-civic-700 transition-colors">
              <span>Enter Citizen Portal</span>
              <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* MP Card */}
          <Link
            href="/dashboard"
            className="group relative flex flex-col justify-between rounded-2xl border border-surface-200 bg-white p-8 text-left transition-all duration-300 hover:border-amber-500/60 hover:shadow-lg hover:-translate-y-1"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-6 group-hover:scale-110 transition-transform shadow-sm">
                <Landmark size={24} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Representative Portal
              </span>
              <h2 className="font-display font-bold text-2xl text-surface-900 mt-1">
                I am an MP
              </h2>
              <p className="text-sm text-surface-700 mt-3 leading-relaxed">
                Access interactive constituency heatmaps, proactive AI infrastructure crawls, and delegate actionable solutions to municipal departments.
              </p>

              <ul className="mt-6 space-y-2.5 text-xs text-surface-700/80 border-t border-surface-200 pt-6">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Interactive Mapbox heatmaps & priority rankings</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Proactive municipal infrastructure anomaly crawls</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Direct task delegation to PWD, BBMP & local agencies</span>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4 flex items-center justify-between text-sm font-display font-semibold text-amber-600 group-hover:text-amber-700 transition-colors">
              <span>Enter MP Dashboard</span>
              <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>

        <div className="mt-12 flex items-center gap-2 text-xs text-surface-700/60 font-medium">
          <Activity size={14} className="text-civic-600" />
          <span>Real-time cross-portal synchronization enabled</span>
        </div>
      </div>
    </main>
  );
}

