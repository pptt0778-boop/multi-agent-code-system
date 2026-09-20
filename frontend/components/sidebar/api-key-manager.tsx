"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { maskApiKey } from "@/lib/utils";
import type { LLMProvider } from "@/types";

const PROVIDERS: Array<{ id: LLMProvider; label: string; placeholder: string }> = [
  { id: "openai", label: "OpenAI", placeholder: "sk-..." },
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { id: "google", label: "Google Gemini", placeholder: "AIza..." },
  { id: "openrouter", label: "OpenRouter", placeholder: "sk-or-..." },
  { id: "deepseek", label: "DeepSeek", placeholder: "sk-..." },
];

export function ApiKeyManager() {
  const { apiKeys, setApiKey } = useWorkspace();
  const [drafts, setDrafts] = useState<Partial<Record<LLMProvider, string>>>({});
  const [visible, setVisible] = useState<Partial<Record<LLMProvider, boolean>>>({});

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <KeyRound size={14} className="text-[var(--accent)]" />
        <h3 className="panel-title">API Keys</h3>
      </div>
      <div className="flex flex-col gap-2">
        {PROVIDERS.map((p) => {
          const stored = apiKeys.find((k) => k.provider === p.id)?.key;
          const draft = drafts[p.id] ?? "";
          const isVisible = visible[p.id] ?? false;
          return (
            <div key={p.id} className="panel flex flex-col gap-1.5 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{p.label}</span>
                {stored && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                    <Check size={10} /> configured
                  </span>
                )}
              </div>
              {stored && !draft ? (
                <div className="flex items-center justify-between rounded-md bg-black/30 px-2 py-1.5">
                  <code className="text-[11px] text-[var(--muted-foreground)]">
                    {isVisible ? stored : maskApiKey(stored)}
                  </code>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        setVisible((v) => ({ ...v, [p.id]: !isVisible }))
                      }
                      className="p-1 text-[var(--muted-foreground)] hover:text-foreground"
                      aria-label="Toggle key visibility"
                    >
                      {isVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button
                      onClick={() => setApiKey(p.id, "")}
                      className="p-1 text-[var(--muted-foreground)] hover:text-red-400"
                      aria-label="Remove key"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    type={isVisible ? "text" : "password"}
                    value={draft}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [p.id]: e.target.value }))
                    }
                    placeholder={p.placeholder}
                    className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-black/30 px-2 py-1.5 text-[11px] outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    onClick={() => {
                      if (draft.trim()) {
                        setApiKey(p.id, draft.trim());
                        setDrafts((d) => ({ ...d, [p.id]: "" }));
                      }
                    }}
                    className="rounded-md bg-[var(--accent)] px-2 text-[11px] font-medium text-[var(--accent-foreground)] transition hover:brightness-110"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
