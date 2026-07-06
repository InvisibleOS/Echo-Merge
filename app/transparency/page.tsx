import Link from "next/link";
import { getCases, getConstituencyHealth } from "@/lib/server/action-os";

export default function TransparencyPage() {
  const health = getConstituencyHealth({ constituency: "Bengaluru South" });
  const cases = getCases({ constituency: "Bengaluru South" }).slice(0, 24);

  return (
    <main className="min-h-screen bg-paper px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-wide font-bold text-civic-600">Public Transparency</span>
            <h1 className="font-display font-800 text-3xl text-ink-900 mt-2">Constituency Work Tracker</h1>
            <p className="text-sm text-ink-800/60 mt-2 max-w-2xl">
              Citizens can see routed issues, current status, and whether government action is improving constituency health.
            </p>
          </div>
          <Link href="/submit" className="rounded-md bg-civic-600 px-4 py-2 text-sm font-semibold text-white">
            Report an issue
          </Link>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <Stat label="Health index" value={`${health.health_index}/100`} />
          <Stat label="Trust score" value={`${health.citizen_trust_score}/100`} />
          <Stat label="Open cases" value={health.open_cases} />
          <Stat label="Resolved this week" value={health.resolved_this_week} />
        </section>

        <section className="mt-6 rounded-lg border border-ink-900/10 bg-white p-4">
          <h2 className="font-display font-bold text-xl text-ink-900">Public Cases</h2>
          <div className="mt-4 divide-y divide-ink-900/8">
            {cases.map((item) => (
              <Link
                key={item.case_id}
                href={`/case/${item.case_id}`}
                className="grid grid-cols-1 md:grid-cols-[140px_1fr_140px_120px] gap-3 py-3 text-sm hover:bg-ink-900/[0.02]"
              >
                <span className="font-mono text-civic-700">{item.case_id}</span>
                <span className="font-medium text-ink-900">{item.title}</span>
                <span className="text-ink-800/55">{item.department.short_name}</span>
                <span className="font-semibold text-ink-900">{item.status}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-ink-900/10 bg-white p-4">
      <div className="text-2xl font-display font-bold text-ink-900">{value}</div>
      <div className="text-xs uppercase font-semibold text-ink-800/45 mt-1">{label}</div>
    </div>
  );
}

