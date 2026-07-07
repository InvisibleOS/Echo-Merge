"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Loader2 } from "lucide-react";

/**
 * Citizen-dashboard-only page translator.
 *
 * Powered by Google Cloud Translation API (proxied through /api/translate so the
 * key stays server-side). Picking a language walks the visible text nodes under
 * `#citizen-root`, batch-translates them, and swaps them in place. A live cache
 * avoids re-calling the API for repeated strings, and a MutationObserver keeps
 * re-rendered content (e.g. the polling complaint list) translated. "English —
 * Original" restores the source text.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";
const ROOT_ID = "citizen-root";

const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English — Original" },
  { code: "hi", label: "हिन्दी — Hindi" },
  { code: "kn", label: "ಕನ್ನಡ — Kannada" },
  { code: "ta", label: "தமிழ் — Tamil" },
  { code: "te", label: "తెలుగు — Telugu" },
  { code: "ml", label: "മലയാളം — Malayalam" },
  { code: "mr", label: "मराठी — Marathi" },
  { code: "bn", label: "বাংলা — Bengali" },
  { code: "gu", label: "ગુજરાતી — Gujarati" },
  { code: "pa", label: "ਪੰਜਾਬੀ — Punjabi" },
  { code: "ur", label: "اردو — Urdu" },
];

// Keep a letter from any major Indic block OR Latin — skips pure numbers / IDs / symbols.
const HAS_LETTER = /[A-Za-zऀ-෿؀-ۿ]/;

export default function PageTranslator() {
  const [lang, setLang] = useState("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // node -> its original (English) text; node -> the translated text we last set.
  const originals = useRef<WeakMap<Text, string>>(new WeakMap());
  const translated = useRef<WeakMap<Text, string>>(new WeakMap());
  // source text -> { langCode -> translatedText }
  const cache = useRef<Map<string, Map<string, string>>>(new Map());
  const observerRef = useRef<MutationObserver | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef("en");

  function getRoot(): HTMLElement | null {
    return document.getElementById(ROOT_ID);
  }

  function collectTextNodes(root: HTMLElement): Text[] {
    const nodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const v = node.nodeValue;
        if (!v || !v.trim() || !HAS_LETTER.test(v)) return NodeFilter.FILTER_REJECT;
        const parent = (node as Text).parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
        if (parent.closest("[data-no-translate]")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n = walker.nextNode();
    while (n) {
      nodes.push(n as Text);
      n = walker.nextNode();
    }
    return nodes;
  }

  function cacheGet(src: string, code: string): string | undefined {
    return cache.current.get(src)?.get(code);
  }
  function cacheSet(src: string, code: string, value: string) {
    let m = cache.current.get(src);
    if (!m) {
      m = new Map();
      cache.current.set(src, m);
    }
    m.set(code, value);
  }

  // Re-add the original leading/trailing whitespace that we trimmed for the API.
  function withSpacing(src: string, out: string): string {
    const lead = src.match(/^\s*/)?.[0] ?? "";
    const trail = src.match(/\s*$/)?.[0] ?? "";
    return lead + out + trail;
  }

  async function translateBatch(texts: string[], code: string): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const missing = texts.filter((t) => cacheGet(t, code) === undefined);
    if (missing.length > 0) {
      const res = await fetch(`${API_BASE}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: missing, target: code, source: "en" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Translation failed (${res.status})`);
      }
      const { translations } = await res.json();
      missing.forEach((src, i) => cacheSet(src, code, translations[i] ?? src));
    }
    for (const t of texts) result.set(t, cacheGet(t, code) ?? t);
    return result;
  }

  function withObserverPaused(fn: () => void) {
    const obs = observerRef.current;
    obs?.disconnect();
    fn();
    if (langRef.current !== "en") reconnectObserver();
  }

  function restoreAll() {
    const root = getRoot();
    if (!root) return;
    withObserverPaused(() => {
      for (const node of collectTextNodes(root)) {
        const orig = originals.current.get(node);
        if (orig !== undefined && node.nodeValue !== orig) node.nodeValue = orig;
        translated.current.delete(node);
      }
    });
  }

  // Translate any node that isn't already showing the translation we set for it.
  async function translatePass(code: string) {
    const root = getRoot();
    if (!root) return;
    const nodes = collectTextNodes(root);

    const pending: Text[] = [];
    for (const node of nodes) {
      const current = node.nodeValue ?? "";
      if (translated.current.get(node) === current) continue; // already translated & unchanged
      originals.current.set(node, current); // current text is a fresh English source
      pending.push(node);
    }
    if (pending.length === 0) return;

    const uniqueSources = Array.from(
      new Set(pending.map((n) => (n.nodeValue ?? "").trim()).filter(Boolean))
    );
    const map = await translateBatch(uniqueSources, code);
    if (langRef.current !== code) return; // language changed mid-flight

    withObserverPaused(() => {
      for (const node of pending) {
        const src = node.nodeValue ?? "";
        const out = map.get(src.trim());
        if (out) {
          const finalText = withSpacing(src, out);
          node.nodeValue = finalText;
          translated.current.set(node, finalText);
        }
      }
    });
  }

  function reconnectObserver() {
    const root = getRoot();
    if (!root) return;
    if (!observerRef.current) {
      observerRef.current = new MutationObserver(() => {
        if (langRef.current === "en") return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          translatePass(langRef.current).catch(() => {});
        }, 350);
      });
    }
    observerRef.current.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  }

  async function apply(code: string) {
    setError(null);
    langRef.current = code;
    if (code === "en") {
      observerRef.current?.disconnect();
      restoreAll();
      return;
    }
    setBusy(true);
    try {
      await translatePass(code);
      reconnectObserver();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translation unavailable");
      langRef.current = "en";
      setLang("en");
      restoreAll();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="relative flex items-center" data-no-translate>
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-2.5 text-civic-600">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
        </span>
        <select
          aria-label="Translate this page"
          title="Translate this page (Google Translate)"
          value={lang}
          disabled={busy}
          onChange={(e) => {
            const code = e.target.value;
            setLang(code);
            void apply(code);
          }}
          className="appearance-none bg-white/80 hover:bg-white border border-surface-200 rounded-lg pl-8 pr-7 py-1.5 text-xs font-semibold text-surface-900 shadow-sm outline-none focus:border-civic-500 transition-colors disabled:opacity-60 cursor-pointer"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 text-surface-400 text-[9px]">▼</span>
      </div>
      {error && (
        <span className="absolute top-full right-0 mt-1 whitespace-nowrap text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5 shadow-sm">
          {error}
        </span>
      )}
    </div>
  );
}
