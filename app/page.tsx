import Link from "next/link";
import { Users, Landmark, ArrowRight, ShieldCheck, Activity } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-[#090C15] text-slate-200 relative overflow-hidden font-body">
      {/* ── Ambient Drifting Orbs ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-civic-500/10 rounded-full blur-[120px] pointer-events-none animate-float-slow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-signal-amber/5 rounded-full blur-[120px] pointer-events-none animate-float-reverse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-gradient-to-r from-civic-500/5 to-transparent rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl w-full flex flex-col items-center text-center">
        {/* Top Feature Tag */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/60 border border-slate-800 backdrop-blur-md shadow-lg text-slate-300 text-[10px] sm:text-xs font-display font-bold uppercase tracking-wider mb-8 animate-[fadeSlideIn_300ms_ease-out]">
          <ShieldCheck size={14} className="text-civic-400" />
          <span>Municipal Intelligence &bull; AI Proactive Action OS</span>
        </div>

        {/* Headline */}
        <h1 className="font-display font-extrabold text-4xl sm:text-6xl tracking-tight text-white max-w-3xl leading-[1.1] animate-[fadeSlideIn_400ms_ease-out]">
          A Unified Command Center for <span className="text-transparent bg-clip-text bg-gradient-to-r from-civic-400 via-indigo-200 to-amber-300">Constituency Development</span>
        </h1>
        
        <p className="mt-6 text-slate-400 max-w-xl text-sm sm:text-base leading-relaxed font-medium animate-[fadeSlideIn_500ms_ease-out]">
          Bridging the gap between citizens and representatives. Report neighborhood needs with media or text, and orchestrate automated solutions in real-time.
        </p>

        {/* ── Two-Card Role Gate ── */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl px-2">
          
          {/* Citizen Card */}
          <Link
            href="/citizen"
            className="group relative flex flex-col justify-between rounded-3xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-xs p-8 text-left transition-all duration-300 hover:border-civic-500/50 hover:bg-slate-900/50 hover:shadow-[0_20px_50px_-15px_rgba(79,70,229,0.2)] hover:-translate-y-1.5"
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-civic-500/10 border border-civic-500/30 flex items-center justify-center text-civic-400 mb-8 group-hover:scale-110 group-hover:bg-civic-500/20 group-hover:border-civic-500/50 transition-all duration-300 shadow-inner">
                <Users size={26} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-civic-400">
                Citizen Portal
              </span>
              <h2 className="font-display font-extrabold text-2xl text-white mt-1.5">
                I am a Citizen
              </h2>
              <p className="text-sm text-slate-400 mt-4 leading-relaxed font-medium">
                Submit local grievances in your native language via text, photos, or voice notes. Monitor live progress as agencies act.
              </p>

              <ul className="mt-8 space-y-3.5 text-xs text-slate-400 border-t border-slate-900 pt-8">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-civic-500 mt-1.5 shrink-0" />
                  <span>Multilingual media submission (BCP-47 automatic translate)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-civic-500 mt-1.5 shrink-0" />
                  <span>Real-time status tracking & verified resolution receipts</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-civic-500 mt-1.5 shrink-0" />
                  <span>Interactive local map pins & regional dashboard transparency</span>
                </li>
              </ul>
            </div>

            <div className="mt-10 pt-4 flex items-center justify-between text-sm font-display font-bold text-civic-400 group-hover:text-civic-300 transition-colors border-t border-slate-900/50">
              <span>Enter Citizen Gate</span>
              <ArrowRight size={18} className="transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>

          {/* MP Card */}
          <Link
            href="/dashboard"
            className="group relative flex flex-col justify-between rounded-3xl border border-slate-800/80 bg-slate-900/30 backdrop-blur-xs p-8 text-left transition-all duration-300 hover:border-amber-500/50 hover:bg-slate-900/50 hover:shadow-[0_20px_50px_-15px_rgba(245,158,11,0.15)] hover:-translate-y-1.5"
          >
            <div>
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-8 group-hover:scale-110 group-hover:bg-amber-500/20 group-hover:border-amber-500/50 transition-all duration-300 shadow-inner">
                <Landmark size={26} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Representative Portal
              </span>
              <h2 className="font-display font-extrabold text-2xl text-white mt-1.5">
                I am an MP
              </h2>
              <p className="text-sm text-slate-400 mt-4 leading-relaxed font-medium">
                Orchestrate civic planning, track department workloads, inspect Mapbox heatmaps, and monitor automated AI telemetry anomalies.
              </p>

              <ul className="mt-8 space-y-3.5 text-xs text-slate-400 border-t border-slate-900 pt-8">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span>Real-time constituency heatmaps & category density metrics</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span>Proactive sensor telemetry & crawler anomaly sweeps</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span>One-click workload delegation to PWD, BWSSB, BESCOM</span>
                </li>
              </ul>
            </div>

            <div className="mt-10 pt-4 flex items-center justify-between text-sm font-display font-bold text-amber-400 group-hover:text-amber-300 transition-colors border-t border-slate-900/50">
              <span>Access Representative Console</span>
              <ArrowRight size={18} className="transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>
        </div>

        {/* Sync Footer status */}
        <div className="mt-16 flex items-center gap-2 text-[11px] text-slate-500 font-bold uppercase tracking-widest animate-[fadeSlideIn_600ms_ease-out]">
          <Activity size={14} className="text-civic-400 animate-pulse" />
          <span>Real-time Command Center Sync Enabled</span>
        </div>
      </div>
    </main>
  );
}

