"use client";

import { useState } from "react";
import LanguageSelector from "./LanguageSelector";
import TextInput from "./TextInput";
import VoiceRecorder from "./VoiceRecorder";
import PhotoUpload from "./PhotoUpload";
import SubmissionSuccess from "./SubmissionSuccess";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { submitComplaint } from "@/lib/api";
import { GeoPoint } from "@/lib/types";

export default function SubmissionForm() {
  const [language, setLanguage] = useState("hi");
  const [text, setText] = useState("");
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoPoint | undefined>(undefined);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

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

  const canSubmit = text.trim().length > 0 || audioBase64 || photoBase64;

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
        geo,
        channel: "web",
      });
      setSubmissionId(res.submission_id);
    } catch (err) {
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
    setError(null);
  }

  if (submissionId) {
    return (
      <SubmissionSuccess
        submissionId={submissionId}
        onSubmitAnother={reset}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <LanguageSelector value={language} onChange={setLanguage} />

      <TextInput value={text} onChange={setText} />

      <div className="grid sm:grid-cols-2 gap-6">
        <VoiceRecorder onAudioReady={setAudioBase64} />
        <PhotoUpload onPhotoReady={setPhotoBase64} />
      </div>

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
