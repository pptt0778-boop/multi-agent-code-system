"use client";

import { Sparkles } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { cn } from "@/lib/utils";

export function SkillsManager() {
  const { skills, toggleSkill } = useWorkspace();

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-[var(--accent)]" />
        <h3 className="panel-title">Agent Skills</h3>
      </div>
      <div className="flex flex-col gap-1.5">
        {skills.map((s) => (
          <button
            key={s.id}
            onClick={() => toggleSkill(s.id)}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition",
              s.enabled
                ? "border-[var(--accent)]/50 bg-[var(--accent)]/5"
                : "border-[var(--border)] bg-black/20 opacity-60 hover:opacity-90",
            )}
          >
            <span
              className={cn(
                "mt-1 h-2 w-2 shrink-0 rounded-full",
                s.enabled ? "bg-[var(--accent)]" : "bg-zinc-600",
              )}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-xs font-medium">{s.name}</span>
              <span className="text-[10px] leading-snug text-[var(--muted-foreground)]">
                {s.description}
              </span>
            </span>
          </button>
        ))}
        {skills.length === 0 && (
          <p className="text-[11px] text-[var(--muted-foreground)]">
            No skills registered. Add one via the chat input (+) menu.
          </p>
        )}
      </div>
    </section>
  );
}
