import SubmissionForm from "@/components/submission/SubmissionForm";

export default function SubmitPage() {
  return (
    <main className="min-h-screen bg-paper py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <span className="text-signal-amber font-display font-semibold tracking-wide text-xs uppercase">
            Citizen Intake
          </span>
          <h1 className="font-display font-800 text-3xl text-ink-900 mt-2">
            Report an issue to Civic CoPilot
          </h1>
          <p className="text-ink-800/60 text-sm mt-2">
            Text, voice, or a photo in your language. We route it to the right department and create a tracking case.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-ink-900/10 shadow-sm p-6">
          <SubmissionForm />
        </div>
      </div>
    </main>
  );
}
