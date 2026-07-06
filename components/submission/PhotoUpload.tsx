"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";

interface Props {
  onPhotoReady: (base64: string | null) => void;
  description?: string;
  onDescriptionChange?: (desc: string) => void;
}

export default function PhotoUpload({ onPhotoReady, description = "", onDescriptionChange }: Props) {
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
    if (onDescriptionChange) onDescriptionChange("");
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
        <div className="space-y-4">
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
              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-ink-900 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
              aria-label="Remove photo"
            >
              <X size={14} />
            </button>
          </div>

          <div className="animate-[fadeSlideIn_200ms_ease-out] pt-1">
            <label
              htmlFor="photo-description"
              className="block text-sm font-semibold text-ink-800 mb-2"
            >
              Add a description for this image <span className="text-xs font-normal text-ink-800/60">(recommended)</span>
            </label>
            <textarea
              id="photo-description"
              value={description}
              onChange={(e) => onDescriptionChange?.(e.target.value)}
              placeholder="E.g., Broken water pipe flooding the street on 4th Main Road..."
              rows={3}
              lang="auto"
              className="w-full rounded-md border border-ink-900/15 bg-white px-4 py-3 text-base
                         focus:border-civic-500 focus:ring-2 focus:ring-civic-100 outline-none resize-none transition-all"
            />
            {!description.trim() && (
              <p className="text-xs text-amber-700 bg-signal-amber/10 border border-signal-amber/25 rounded px-3 py-1.5 mt-2 flex items-center gap-1.5">
                <span>💡</span> Adding a quick description helps our AI route your report to the exact right department faster.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

