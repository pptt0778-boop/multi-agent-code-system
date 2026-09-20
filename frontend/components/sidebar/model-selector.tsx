"use client";

import { Cpu } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { MODELS } from "@/lib/constants";
import { cn, formatTokens } from "@/lib/utils";

export function ModelSelector() {
  const { model, setModel, apiKeys } = useWorkspace();

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Cpu size={14} className="text-[var(--accent)]" />
        <h3 className="panel-title">Active Model</h3>
      </div>
      <div className="flex flex-col gap-1.5">
        {MODELS.map((m) => {
          const hasKey = apiKeys.some((k) => k.provider === m.provider);
          const active = model === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setModel(m.id)}
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 text-left transition",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/10"
                  : "border-[var(--border)] bg-black/20 hover:border-white/20",
              )}
            >
              <div className="flex flex-col">
                <span className="text-xs font-medium">{m.label}</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  {m.provider} · ctx {formatTokens(m.contextWindow)}
                </span>
              </div>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  hasKey ? "bg-emerald-400" : "bg-zinc-600",
                )}
                title={hasKey ? "API key configured" : "No API key for provider"}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
