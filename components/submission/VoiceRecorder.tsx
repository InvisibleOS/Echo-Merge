"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, Trash2, Play, Pause } from "lucide-react";
import Button from "@/components/ui/Button";

interface Props {
  onAudioReady: (base64: string | null) => void;
}

export default function VoiceRecorder({ onAudioReady }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          onAudioReady(base64);
        };
        reader.readAsDataURL(blob);

        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setError(
        "Couldn't access your microphone. Check your browser permissions and try again."
      );
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function clearRecording() {
    setAudioUrl(null);
    onAudioReady(null);
    setSeconds(0);
    setIsPlaying(false);
  }

  function togglePlayback() {
    if (!audioElRef.current) return;
    if (isPlaying) {
      audioElRef.current.pause();
    } else {
      audioElRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div>
      {error && <p className="text-signal-red text-sm mb-2">{error}</p>}

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
    </div>
  );
}
