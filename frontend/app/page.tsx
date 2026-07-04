import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-paper">
      <span className="text-signal-amber font-display font-semibold tracking-wide text-sm uppercase mb-4">
        People&rsquo;s Priorities
      </span>
      <h1 className="font-display font-800 text-4xl md:text-5xl text-ink-900 max-w-xl leading-tight">
        Tell us what your constituency needs
      </h1>
      <p className="mt-4 text-ink-800/70 max-w-md">
        Voice, text, or a photo — in your language. Every submission becomes
        evidence your representative can act on.
      </p>

      <div className="mt-10 flex flex-col sm:flex-row gap-4">
        <Link
          href="/submit"
          className="px-8 py-4 rounded-md bg-civic-500 text-white font-display font-semibold hover:bg-civic-600 transition-colors"
        >
          Report a need
        </Link>
        <Link
          href="/dashboard"
          className="px-8 py-4 rounded-md border border-ink-900/15 text-ink-900 font-display font-semibold hover:bg-ink-900/5 transition-colors"
        >
          MP dashboard →
        </Link>
      </div>
    </main>
  );
}
