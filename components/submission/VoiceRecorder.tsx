"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Play, Pause } from "lucide-react";
import Button from "@/components/ui/Button";

interface Props {
  onAudioReady: (base64: string | null, mime?: string) => void;
  /** Final speech-to-text transcript (browser Web Speech API), in the chosen language. */
  onTranscriptReady?: (transcript: string) => void;
  /** The plain-English name of the spoken language (e.g. "Malayalam"). */
  onLanguageChange?: (language: string) => void;
}

// Languages the browser Web Speech API can transcribe. It does NOT auto-detect —
// the speaker picks their language (BCP-47). Chrome/Edge back this with Google's
// speech models and support 100+ locales; these are the common Indian ones + English.
const SPEECH_LANGS: { code: string; native: string; name: string }[] = [
  { code: "en-IN", native: "English", name: "English" },
  { code: "hi-IN", native: "हिन्दी", name: "Hindi" },
  { code: "kn-IN", native: "ಕನ್ನಡ", name: "Kannada" },
  { code: "ta-IN", native: "தமிழ்", name: "Tamil" },
  { code: "te-IN", native: "తెలుగు", name: "Telugu" },
  { code: "ml-IN", native: "മലയാളം", name: "Malayalam" },
  { code: "mr-IN", native: "मराठी", name: "Marathi" },
  { code: "bn-IN", native: "বাংলা", name: "Bengali" },
  { code: "gu-IN", native: "ગુજરાતી", name: "Gujarati" },
  { code: "pa-IN", native: "ਪੰਜਾਬੀ", name: "Punjabi" },
  { code: "ur-IN", native: "اردو", name: "Urdu" },
];

// Minimal typing for the Web Speech API (absent from lib.dom in some setups).
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function VoiceRecorder({ onAudioReady, onTranscriptReady, onLanguageChange }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [langCode, setLangCode] = useState("en-IN");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const wantRecognitionRef = useRef(false);

  const speechSupported = getSpeechRecognition() !== null;
  const langName = SPEECH_LANGS.find((l) => l.code === langCode)?.name || "the selected language";

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  function startTranscription() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return; // browser doesn't support it — audio still records
    try {
      const rec = new Ctor();
      rec.lang = langCode;
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const text = res[0]?.transcript || "";
          if (res.isFinal) {
            finalTranscriptRef.current = (finalTranscriptRef.current + " " + text).trim();
          } else {
            interimText += text;
          }
        }
        setTranscript(finalTranscriptRef.current);
        setInterim(interimText);
      };
      rec.onend = () => {
        // Chrome ends recognition on pauses; restart while still recording.
        if (wantRecognitionRef.current) {
          try {
            rec.start();
          } catch {
            // ignore double-start
          }
        }
      };
      rec.onerror = () => {
        /* transient — onend restarts if still recording */
      };
      recognitionRef.current = rec;
      wantRecognitionRef.current = true;
      rec.start();
    } catch {
      // ignore — audio recording proceeds without live transcription
    }
  }

  function stopTranscription() {
    wantRecognitionRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    const finalText = finalTranscriptRef.current.trim();
    setInterim("");
    setTranscript(finalText);
    onTranscriptReady?.(finalText);
  }

  async function startRecording() {
    setError(null);
    finalTranscriptRef.current = "";
    setTranscript("");
    setInterim("");
    onLanguageChange?.(langName);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const mime = (recorder.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          onAudioReady(base64, mime);
        };
        reader.readAsDataURL(blob);

        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      startTranscription();
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError(
        "Couldn't access your microphone. Check your browser permissions and try again."
      );
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    stopTranscription();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function clearRecording() {
    setAudioUrl(null);
    onAudioReady(null);
    setSeconds(0);
    setIsPlaying(false);
    finalTranscriptRef.current = "";
    setTranscript("");
    setInterim("");
    onTranscriptReady?.("");
  }

  function togglePlayback() {
    if (!audioElRef.current) return;
    if (isPlaying) {
      audioElRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Playback error:", err);
        setError("Your browser does not support previewing this audio format.");
        setIsPlaying(false);
      });
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div>
      {error && <p className="text-signal-red text-sm mb-2">{error}</p>}

      {/* Spoken-language picker — the browser transcriber needs to know the language */}
      {!audioUrl && (
        <div className="flex items-center gap-2 mb-3">
          <label htmlFor="voice-lang" className="text-xs font-semibold text-ink-800/70">
            Spoken language
          </label>
          <select
            id="voice-lang"
            value={langCode}
            onChange={(e) => {
              setLangCode(e.target.value);
              onLanguageChange?.(SPEECH_LANGS.find((l) => l.code === e.target.value)?.name || "");
            }}
            disabled={isRecording}
            className="text-xs font-medium bg-white border border-ink-900/15 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-civic-500/40 disabled:opacity-60"
          >
            {SPEECH_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native} ({l.name})
              </option>
            ))}
          </select>
        </div>
      )}

      {!audioUrl && !isRecording && (
        <Button
          type="button"
          variant="secondary"
          onClick={startRecording}
          className="flex items-center gap-2"
        >
          <Mic size={18} /> Start recording
        </Button>
      )}

      {isRecording && (
        <div className="flex items-center gap-3 rounded-md border border-signal-red/30 bg-red-50 px-4 py-3">
          <span className="w-2.5 h-2.5 rounded-full bg-signal-red animate-pulse" />
          <span className="text-sm font-medium text-signal-red">
            Recording… {mm}:{ss}
          </span>
          <button
            type="button"
            onClick={stopRecording}
            className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-signal-red"
          >
            <Square size={16} /> Stop
          </button>
        </div>
      )}

      {audioUrl && !isRecording && (
        <div className="flex items-center gap-3 rounded-md border border-ink-900/15 bg-white px-4 py-3">
          <audio
            ref={audioElRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
          <button
            type="button"
            onClick={togglePlayback}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-civic-500 text-white"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <span className="text-sm text-ink-800">
            Voice message · {mm}:{ss}
          </span>
          <button
            type="button"
            onClick={clearRecording}
            className="ml-auto text-ink-800/50 hover:text-signal-red"
            aria-label="Remove recording"
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}

      {/* Live / final transcript from the browser speech-to-text engine */}
      {(isRecording || transcript || interim) && (
        <div className="mt-3 rounded-md border border-civic-400/30 bg-civic-50/50 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Mic size={12} className="text-civic-600" />
            <span className="text-[10px] font-bold uppercase tracking-wide text-civic-700">
              Live transcript · {langName}{isRecording ? " · listening…" : ""}
            </span>
          </div>
          <p className="text-sm text-ink-900 leading-relaxed">
            {transcript}
            {interim && <span className="text-ink-800/50"> {interim}</span>}
            {!transcript && !interim && (
              <span className="text-ink-800/40 italic">Speak now — your words will appear here…</span>
            )}
          </p>
          {!isRecording && transcript && (
            <p className="text-[11px] text-ink-800/50 mt-1.5">
              We&apos;ll use this as your description and translate it automatically.
            </p>
          )}
        </div>
      )}

      {!speechSupported && (
        <p className="mt-2 text-[11px] text-signal-amber font-medium">
          Live transcription isn&apos;t supported in this browser (try Chrome or Edge). Your voice note is still recorded and tagged as {langName}.
        </p>
      )}
    </div>
  );
}
