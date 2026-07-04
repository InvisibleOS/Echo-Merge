"use client";

interface Props {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}

export default function TextInput({ value, onChange, placeholder }: Props) {
  return (
    <div>
      <label
        htmlFor="complaint-text"
        className="block text-sm font-semibold text-ink-800 mb-2"
      >
        Describe the issue (optional if you record voice or add a photo)
      </label>
      <textarea
        id="complaint-text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Type here in your own language…"}
        rows={4}
        lang="auto"
        className="w-full rounded-md border border-ink-900/15 bg-white px-4 py-3 text-base
                   focus:border-civic-500 focus:ring-2 focus:ring-civic-100 outline-none resize-none"
      />
    </div>
  );
}
