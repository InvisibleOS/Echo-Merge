import Link from "next/link";
import { getCases } from "@/lib/server/action-os";

export default async function CaseTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = getCases({ constituency: "Bengaluru South" }).find((caseItem) => caseItem.case_id === id);

  if (!item) {
    return (
      <main className="min-h-screen bg-paper flex items-center justify-center px-4">
        <div className="rounded-lg bg-white border border-ink-900/10 p-8 text-center max-w-md">
          <h1 className="font-display font-bold text-2xl text-ink-900">Case not found</h1>
          <p className="text-sm text-ink-800/60 mt-2">Check the tracking ID or return to the public tracker.</p>
          <Link href="/transparency" className="inline-block mt-5 rounded-md bg-civic-600 px-4 py-2 text-sm font-semibold text-white">
            Public tracker
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/transparency" className="text-sm font-semibold text-civic-700">Back to tracker</Link>
        <section className="mt-4 rounded-lg bg-white border border-ink-900/10 p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-bold text-civic-600">{item.case_id}</span>
              <h1 className="font-display font-bold text-2xl text-ink-900 mt-2">{item.title}</h1>
              <p className="text-sm text-ink-800/60 mt-2">{item.resolution_brief.citizen_message}</p>
            </div>
            <span className="rounded-full bg-civic-50 px-3 py-1 text-sm font-bold text-civic-700">{item.status}</span>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Info label="Department" value={item.department.name} />
            <Info label="SLA status" value={item.sla_status} />
            <Info label="Priority" value={`${item.priority_band} (${item.priority_score.toFixed(0)})`} />
          </div>

          <div className="mt-6 rounded-md bg-ink-900/[0.03] p-4">
            <h2 className="font-semibold text-ink-900">What happens next</h2>
            <ul className="mt-3 space-y-2">
              {item.resolution_brief.recommended_steps.map((step: string) => (
                <li key={step} className="text-sm text-ink-800/70 flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-civic-500 shrink-0" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink-900/10 p-3">
      <div className="text-[10px] uppercase font-bold text-ink-800/45">{label}</div>
      <div className="text-sm font-semibold text-ink-900 mt-1">{value}</div>
    </div>
  );
}
