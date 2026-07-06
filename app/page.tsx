import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-paper px-6 py-8">
      <div className="max-w-6xl mx-auto min-h-[calc(100vh-4rem)] flex flex-col justify-center">
        <span className="text-signal-amber font-display font-semibold tracking-wide text-sm uppercase mb-4">
          Constituency Intelligence & Action OS
        </span>
        <h1 className="font-display font-800 text-4xl md:text-6xl text-ink-900 max-w-4xl leading-tight">
          Turn citizen signals into coordinated governance action
        </h1>
        <p className="mt-5 text-ink-800/70 max-w-2xl text-lg">
          Citizens report issues in any language. AI translates, routes, clusters,
          scores, and briefs them so MPs, MLAs, departments, and citizens can move
          from complaint to verified resolution.
        </p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <HomeLink href="/submit" title="Citizen Intake" body="Text, voice, photo, status tracking, schemes" primary />
          <HomeLink href="/dashboard" title="MP Command Center" body="Hotspots, cases, Copilot, SLA and budgets" />
          <HomeLink href="/department" title="Department Portal" body="Assigned work, SLA queue, evidence updates" />
          <HomeLink href="/transparency" title="Public Tracker" body="Trust score, public status, citizen visibility" />
        </div>
      </div>
    </main>
  );
}

function HomeLink({
  href,
  title,
  body,
  primary = false,
}: {
  href: string;
  title: string;
  body: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "rounded-lg bg-civic-600 p-5 text-white shadow-sm hover:bg-civic-700 transition-colors"
          : "rounded-lg bg-white p-5 text-ink-900 border border-ink-900/10 hover:border-civic-300 hover:shadow-sm transition-all"
      }
    >
      <span className="font-display font-bold text-lg">{title}</span>
      <span className={primary ? "block mt-2 text-sm text-white/75" : "block mt-2 text-sm text-ink-800/60"}>
        {body}
      </span>
    </Link>
  );
}
