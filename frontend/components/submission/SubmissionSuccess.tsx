import { CheckCircle2 } from "lucide-react";
import Button from "@/components/ui/Button";

export default function SubmissionSuccess({
  submissionId,
  onSubmitAnother,
}: {
  submissionId: string;
  onSubmitAnother: () => void;
}) {
  return (
    <div className="text-center py-10 px-6">
      <CheckCircle2 className="mx-auto text-signal-green" size={56} />
      <h2 className="font-display font-bold text-2xl mt-4 text-ink-900">
        Received
      </h2>
      <p className="mt-2 text-ink-800/70 max-w-sm mx-auto">
        Your report has been logged and will be analyzed alongside others
        from your area.
      </p>
      <p className="mt-4 text-xs text-ink-800/40 font-mono">
        Reference: {submissionId}
      </p>
      <Button
        variant="secondary"
        className="mt-8"
        onClick={onSubmitAnother}
      >
        Report another issue
      </Button>
    </div>
  );
}
