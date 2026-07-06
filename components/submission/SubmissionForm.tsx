"use client";

import { useState } from "react";
import { Mic, Camera, Type } from "lucide-react";
import clsx from "clsx";
import LanguageSelector from "./LanguageSelector";
import TextInput from "./TextInput";
import VoiceRecorder from "./VoiceRecorder";
import PhotoUpload from "./PhotoUpload";
import SubmissionSuccess from "./SubmissionSuccess";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { submitComplaint } from "@/lib/api";
import { DepartmentSummary, GeoPoint, SchemeMatch } from "@/lib/types";

type InputMode = "text" | "voice" | "photo";

const INPUT_MODES: { id: InputMode; label: string; icon: typeof Mic }[] = [
  { id: "voice", label: "Record Voice Note", icon: Mic },
  { id: "photo", label: "Submit Photo", icon: Camera },
  { id: "text", label: "Type Text", icon: Type },
];

export default function SubmissionForm() {
  const [language, setLanguage] = useState("hi");
  const [activeMode, setActiveMode] = useState<InputMode | null>(null);
  const [text, setText] = useState("");
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoPoint | undefined>(undefined);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | undefined>(undefined);
  const [department, setDepartment] = useState<DepartmentSummary | undefined>(undefined);
  const [schemeMatches, setSchemeMatches] = useState<SchemeMatch[]>([]);

  function requestLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        /* silently ignore — location is optional, never block submission */
      }
    );
  }

  const canSubmit = (text.trim().length > 0 || audioBase64 || photoBase64);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await submitComplaint({
        raw_text: text.trim() || undefined,
        audio_base64: audioBase64 || undefined,
        photo_base64: photoBase64 || undefined,
        language,
        geo: geo ? { ...geo, ward: undefined } : undefined, // frontend doesn't know ward
        channel: "web",
      });
      setSubmissionId(res.submission_id);
      setCaseId(res.case_id);
      setDepartment(res.department);
      setSchemeMatches(res.scheme_matches || []);
    } catch {
      setError(
        "Something went wrong sending your report. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function reset() {
    setText("");
    setAudioBase64(null);
    setPhotoBase64(null);
    setSubmissionId(null);
    setCaseId(undefined);
    setDepartment(undefined);
    setSchemeMatches([]);
    setError(null);
    setActiveMode(null);
  }

  /** Shows a filled dot when the mode has captured data */
  function hasData(mode: InputMode): boolean {
    switch (mode) {
      case "text":
        return text.trim().length > 0;
      case "voice":
        return audioBase64 !== null;
      case "photo":
        return photoBase64 !== null;
    }
  }

  if (submissionId) {
    return (
      <SubmissionSuccess
        submissionId={submissionId}
        caseId={caseId}
        department={department}
        schemeMatches={schemeMatches}
        onSubmitAnother={reset}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <LanguageSelector value={language} onChange={setLanguage} />

      {/* ── Input Mode Selector Row ── */}
      <div>
        <p className="block text-sm font-semibold text-ink-800 mb-3">
          How would you like to report?
        </p>
        <div className="grid grid-cols-3 gap-3">
          {INPUT_MODES.map(({ id, label, icon: Icon }) => {
            const isActive = activeMode === id;
            const captured = hasData(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveMode(isActive ? null : id)}
                className={clsx(
                  "relative flex flex-col items-center justify-center gap-2 rounded-md border-2 px-3 py-4 text-center transition-all duration-200",
                  "font-display font-semibold text-xs sm:text-sm",
                  isActive
                    ? "border-civic-500 bg-civic-50 text-civic-700 shadow-sm"
                    : "border-ink-900/12 bg-white text-ink-800/70 hover:border-civic-400/60 hover:text-civic-600 hover:bg-civic-50/40"
                )}
                id={`input-mode-${id}`}
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.4 : 1.8}
                  className="transition-colors"
                />
                <span className="leading-tight">{label}</span>

                {/* Data-captured indicator dot */}
                {captured && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-signal-green" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active Input Panel ── */}
      {activeMode && (
        <div className="rounded-md border border-ink-900/8 bg-ink-900/[0.02] p-4 animate-[fadeSlideIn_200ms_ease-out]">
          {activeMode === "text" && (
            <TextInput value={text} onChange={setText} />
          )}
          {activeMode === "voice" && (
            <VoiceRecorder onAudioReady={setAudioBase64} />
          )}
          {activeMode === "photo" && (
            <PhotoUpload onPhotoReady={setPhotoBase64} />
          )}
        </div>
      )}

      <button
        type="button"
        onClick={requestLocation}
        className="text-xs text-civic-600 underline underline-offset-2"
      >
        {geo ? "✓ Location attached" : "Attach my current location (optional)"}
      </button>

      {error && (
        <p className="text-signal-red text-sm bg-red-50 border border-red-200 rounded-md px-4 py-3">
          {error}
        </p>
      )}

      <Button
        type="submit"
        fullWidth
        disabled={!canSubmit || isSubmitting}
        className="flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <LoadingSpinner size={16} /> Sending…
          </>
        ) : (
          "Submit report"
        )}
      </Button>
    </form>
  );
}
