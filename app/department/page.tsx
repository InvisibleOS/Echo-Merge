import Link from "next/link";
import { getCases, getDepartmentAnalytics } from "@/lib/server/action-os";
import { Clock, FileCheck2, ShieldAlert } from "lucide-react";

export default function DepartmentPortalPage() {
  const departments = getDepartmentAnalytics({ constituency: "Bengaluru South" });
  const cases = getCases({ constituency: "Bengaluru South" }).slice(0, 18);

  return (
    <main className="min-h-screen bg-ink-950 text-white px-4 py-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <span className="text-xs uppercase tracking-wide font-bold text-signal-amber">
              Department Official Workspace
            </span>
            <h1 className="font-display font-bold text-3xl mt-2">Assigned Work & SLA Control</h1>
            <p className="text-white/55 text-sm mt-2 max-w-2xl">
              Department teams receive routed cases, update progress, upload evidence, and keep SLA commitments visible to representatives.
            </p>
          </div>
          <Link href="/dashboard" className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-ink-900">
            MP dashboard
          </Link>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {departments.slice(0, 3).map((dept) => (
            <div key={dept.id} className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold">{dept.short_name}</h2>
                  <p className="text-xs text-white/50">{dept.officer}</p>
                </div>
                <span className="text-sm font-bold text-civic-300">{dept.sla_compliance}%</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Metric label="Active" value={dept.active_cases} />
                <Metric label="Breaches" value={dept.sla_breaches} />
                <Metric label="Workload" value={dept.workload_score} />
              </div>
              <p className="mt-3 text-xs text-white/55 leading-relaxed">{dept.recommended_action}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-lg border border-white/10 bg-white p-4 text-ink-900">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display font-bold text-xl">Work Queue</h2>
              <p className="text-sm text-ink-800/55">Evidence-first status updates for field teams</p>
            </div>
            <span className="text-xs font-semibold text-ink-800/45">{cases.length} visible cases</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {cases.map((item) => (
              <article key={item.case_id} className="rounded-md border border-ink-900/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-civic-600">{item.case_id}</span>
                    <h3 className="font-semibold mt-1 leading-snug">{item.title}</h3>
                  </div>
                  <span className="rounded-full bg-ink-900/5 px-2 py-1 text-xs font-bold">{item.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge icon={<Clock size={12} />} text={item.sla_status} />
                  <Badge icon={<ShieldAlert size={12} />} text={item.priority_band} />
                  <Badge icon={<FileCheck2 size={12} />} text={item.department.short_name} />
                </div>
                <p className="mt-3 text-sm text-ink-800/65 leading-relaxed">{item.resolution_brief.first_action}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-white/[0.06] border border-white/10 p-2">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase text-white/45">{label}</div>
    </div>
  );
}

function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink-900/5 px-2 py-1 text-ink-800/70">
      {icon} {text}
    </span>
  );
}

