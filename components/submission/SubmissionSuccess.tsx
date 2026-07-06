import { CheckCircle2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { DepartmentSummary, SchemeMatch } from "@/lib/types";

export default function SubmissionSuccess({
  submissionId,
  caseId,
  department,
  schemeMatches,
  onSubmitAnother,
}: {
  submissionId: string;
  caseId?: string;
  department?: DepartmentSummary;
  schemeMatches?: SchemeMatch[];
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
      {caseId && (
        <p className="mt-1 text-xs text-civic-700 font-mono">
          Case: {caseId}
        </p>
      )}

      {(department || (schemeMatches && schemeMatches.length > 0)) && (
        <div className="mt-6 text-left rounded-md border border-ink-900/10 bg-ink-900/[0.02] p-4 max-w-sm mx-auto">
          {department && (
            <div>
              <span className="text-[10px] uppercase font-bold text-ink-800/45">
                Routed department
              </span>
              <p className="text-sm font-semibold text-ink-900 mt-1">{department.name}</p>
              {department.sla_hours && (
                <p className="text-xs text-ink-800/60 mt-1">
                  Expected first response within {department.sla_hours} hours.
                </p>
              )}
            </div>
          )}

          {schemeMatches && schemeMatches.length > 0 && (
            <div className="mt-4 border-t border-ink-900/5 pt-4">
              <span className="text-[10px] uppercase font-bold text-ink-800/45">
                Relevant scheme guidance
              </span>
              <p className="text-sm font-semibold text-ink-900 mt-1">
                {schemeMatches[0].name}
              </p>
              <p className="text-xs text-ink-800/60 mt-1">{schemeMatches[0].guidance}</p>
            </div>
          )}
        </div>
      )}
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
