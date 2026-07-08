import Link from "next/link";
import { Users, Landmark, ArrowRight, ShieldCheck, Activity } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 mesh-bg text-surface-900 relative overflow-hidden">
      {/* Decorative ambient blobs (enhancing the mesh) */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-civic-500/10 rounded-full blur-[100px] pointer-events-none animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-signal-amber/10 rounded-full blur-[100px] pointer-events-none animate-float" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 max-w-4xl w-full flex flex-col items-center text-center animate-slide-up-fade">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 backdrop-blur-md border border-white shadow-sm text-surface-700 text-xs font-display font-semibold uppercase tracking-wider mb-6 hover:shadow-glow-civic transition-shadow duration-500">
          <ShieldCheck size={14} className="text-civic-600 animate-pulse-glow" />
          <span>People&rsquo;s Priorities &bull; AI Proactive Urban Management</span>
        </div>

        <h1 className="font-display font-extrabold text-4xl sm:text-6xl tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-ink-950 via-ink-800 to-civic-700 max-w-2xl leading-[1.1]">
          Welcome to Your Civic Portal
        </h1>
        <p className="mt-6 text-surface-700 max-w-xl text-base sm:text-lg leading-relaxed font-medium">
          Select your portal to continue. Report neighborhood needs with voice, photo, or text, or manage constituency infrastructure in real-time.
        </p>

        {/* ── Two-Card Role Gate ── */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Citizen Card */}
          <Link
            href="/citizen"
            className="group relative flex flex-col justify-between rounded-3xl glass-panel p-8 text-left transition-all duration-500 hover:border-civic-400 hover:shadow-glow-civic hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-civic-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-white border border-civic-100 flex items-center justify-center text-civic-600 mb-6 group-hover:scale-110 group-hover:bg-civic-50 transition-all duration-300 shadow-soft">
                <Users size={28} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-civic-600 mb-2 block">
                Citizen Portal
              </span>
              <h2 className="font-display font-bold text-3xl text-surface-900 mt-1">
                I am a Citizen
              </h2>
              <p className="text-sm text-surface-700 mt-4 leading-relaxed font-medium">
                Report local issues in your own language, attach photos or voice notes, and track departmental resolution in real-time.
              </p>

              <ul className="mt-8 space-y-3 text-sm text-surface-700 font-medium border-t border-surface-200/50 pt-6">
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-civic-500 shadow-[0_0_8px_rgba(79,70,229,0.6)]" />
                  <span>Voice, photo & text submissions</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-civic-500 shadow-[0_0_8px_rgba(79,70,229,0.6)]" />
                  <span>Live tracking of representative actions</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-civic-500 shadow-[0_0_8px_rgba(79,70,229,0.6)]" />
                  <span>Direct community evidence gathering</span>
                </li>
              </ul>
            </div>

            <div className="relative z-10 mt-10 pt-5 flex items-center justify-between text-sm font-display font-bold text-civic-600 group-hover:text-civic-700 transition-colors">
              <span>Enter Citizen Portal</span>
              <ArrowRight size={20} className="transform group-hover:translate-x-2 transition-transform duration-300" />
            </div>
          </Link>

          {/* MP Card */}
          <Link
            href="/dashboard"
            className="group relative flex flex-col justify-between rounded-3xl glass-panel p-8 text-left transition-all duration-500 hover:border-amber-400 hover:shadow-glow-amber hover:-translate-y-2 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-white border border-amber-100 flex items-center justify-center text-amber-500 mb-6 group-hover:scale-110 group-hover:bg-amber-50 transition-all duration-300 shadow-soft">
                <Landmark size={28} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-2 block">
                Representative Portal
              </span>
              <h2 className="font-display font-bold text-3xl text-surface-900 mt-1">
                I am an MP
              </h2>
              <p className="text-sm text-surface-700 mt-4 leading-relaxed font-medium">
                Access interactive constituency heatmaps, proactive AI infrastructure crawls, and delegate actionable solutions.
              </p>

              <ul className="mt-8 space-y-3 text-sm text-surface-700 font-medium border-t border-surface-200/50 pt-6">
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  <span>Interactive Google Maps heatmaps</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  <span>Proactive municipal infrastructure crawls</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  <span>Direct task delegation to agencies</span>
                </li>
              </ul>
            </div>

            <div className="relative z-10 mt-10 pt-5 flex items-center justify-between text-sm font-display font-bold text-amber-600 group-hover:text-amber-700 transition-colors">
              <span>Enter MP Dashboard</span>
              <ArrowRight size={20} className="transform group-hover:translate-x-2 transition-transform duration-300" />
            </div>
          </Link>
        </div>

        <div className="mt-14 flex items-center gap-2 text-xs text-surface-700/60 font-medium px-4 py-2 rounded-full bg-white/40 backdrop-blur-sm border border-white/50">
          <Activity size={14} className="text-civic-600 animate-pulse" />
          <span>Real-time cross-portal synchronization enabled</span>
        </div>
      </div>
    </main>
  );
}

