"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";

interface Props {
  onPhotoReady: (base64: string | null) => void;
}

export default function PhotoUpload({ onPhotoReady }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      onPhotoReady(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    setPreview(null);
    onPhotoReady(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {!preview && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 rounded-md border-2 border-dashed
                     border-ink-900/20 py-6 text-ink-800/60 hover:border-civic-400 hover:text-civic-600 transition-colors"
        >
          <Camera size={20} />
          <span className="text-sm font-medium">Take or choose a photo</span>
        </button>
      )}

      {preview && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Uploaded evidence"
            className="max-h-48 rounded-md border border-ink-900/15"
          />
          <button
            type="button"
            onClick={clearPhoto}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-ink-900 text-white flex items-center justify-center"
            aria-label="Remove photo"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
