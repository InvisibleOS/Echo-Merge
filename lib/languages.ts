/**
 * Demo language set. Update the `demo: true` flags once the team locks
 * the 3+ languages you're fully demoing end-to-end (Day 1 decision).
 * Ask Person 3 to confirm every code below is actually supported by
 * their Speech-to-Text V2 + Gemini pipeline before relying on it.
 */

export interface LanguageOption {
  code: string; // BCP-47
  label: string; // English name, shown alongside native
  native: string; // native script name
  demo: boolean; // true = one of the 3+ fully-demoed languages
}

export const LANGUAGES: LanguageOption[] = [
  { code: "hi", label: "Hindi", native: "हिंदी", demo: true },
  { code: "ta", label: "Tamil", native: "தமிழ்", demo: true },
  { code: "te", label: "Telugu", native: "తెలుగు", demo: true },
  { code: "bn", label: "Bengali", native: "বাংলা", demo: false },
  { code: "mr", label: "Marathi", native: "मराठी", demo: false },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", demo: false },
  { code: "en", label: "English", native: "English", demo: true },
];

export function getLanguageLabel(code: string): string {
  const lang = LANGUAGES.find((l) => l.code === code);
  return lang ? `${lang.native} (${lang.label})` : code;
}
