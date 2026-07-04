"use client";

import { LANGUAGES } from "@/lib/languages";

interface Props {
  value: string;
  onChange: (code: string) => void;
}

export default function LanguageSelector({ value, onChange }: Props) {
  return (
    <div>
      <label
        htmlFor="language-select"
        className="block text-sm font-semibold text-ink-800 mb-2"
      >
        Choose your language
      </label>
      <select
        id="language-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-ink-900/15 bg-white px-4 py-3 text-base
                   focus:border-civic-500 focus:ring-2 focus:ring-civic-100 outline-none"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.native} — {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
