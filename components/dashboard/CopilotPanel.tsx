"use client";

import { useState } from "react";
import { CopilotResponse } from "@/lib/types";
import { askCopilot } from "@/lib/api";
import { Bot, SendHorizonal } from "lucide-react";

interface Props {
  constituency: string;
}

const QUICK_QUESTIONS = [
  "What should I act on first?",
  "Which department has SLA risk?",
  "What budget should I prioritize?",
  "What is the constituency health score?",
];

export default function CopilotPanel({ constituency }: Props) {
  const [question, setQuestion] = useState(QUICK_QUESTIONS[0]);
  const [answer, setAnswer] = useState<CopilotResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function submit(nextQuestion = question) {
    if (!nextQuestion.trim() || isLoading) return;
    setIsLoading(true);
    setQuestion(nextQuestion);
    try {
      setAnswer(await askCopilot(nextQuestion, constituency));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white p-4">
      <div className="flex items-center gap-2">
        <Bot size={18} className="text-civic-600" />
        <div>
          <h2 className="font-display font-bold text-ink-900">AI MP Copilot</h2>
          <p className="text-xs text-ink-800/55">Ask natural-language questions over constituency data</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-ink-900/12 px-3 py-2 text-sm outline-none focus:border-civic-500"
        />
        <button
          type="button"
          onClick={() => submit()}
          className="rounded-md bg-civic-600 px-3 py-2 text-white"
          aria-label="Ask Copilot"
        >
          <SendHorizonal size={16} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => submit(q)}
            className="rounded-full bg-civic-50 px-3 py-1 text-xs font-semibold text-civic-700"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-md bg-ink-900/[0.03] p-3 min-h-[120px]">
        {isLoading ? (
          <p className="text-sm text-ink-800/60">Thinking through live constituency signals...</p>
        ) : answer ? (
          <div>
            <p className="text-sm text-ink-900 leading-relaxed">{answer.answer}</p>
            <div className="mt-3 border-t border-ink-900/5 pt-3">
              <span className="text-[10px] uppercase font-bold text-ink-800/45">Suggested actions</span>
              <ul className="mt-2 space-y-1">
                {answer.suggested_actions.map((action) => (
                  <li key={action} className="text-xs text-ink-800/70">{action}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-800/60">
            Ask about hotspots, SLA risk, budgets, departments, or what to resolve first.
          </p>
        )}
      </div>
    </section>
  );
}

