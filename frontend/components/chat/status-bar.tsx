"use client";

import { Loader2 } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { cn } from "@/lib/utils";
import type { RunStatus } from "@/types";

const STATUS_LABEL: Record<RunStatus, string> = {
  idle: "Idle",
  coding: "Coder drafting…",
  reviewing: "Judge reviewing…",
  executing: "Executing in sandbox…",
  passed: "All checks passed",
  failed: "Run failed",
  context_limit: "Context limit — compressing",
};

const STATUS_COLOR: Record<RunStatus, string> = {
  idle: "text-[var(--muted-foreground)]",
  coding: "text-[var(--coder)]",
  reviewing: "text-[var(--judge)]",
  executing: "text-violet-400",
  passed: "text-emerald-400",
  failed: "text-red-400",
  context_limit: "text-red-400",
};

export function StatusBar() {
  const { run, busy } = useWorkspace();
  return (
    <div className="flex h-9 shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 text-[11px]">
      <span className={cn("flex items-center gap-1.5 font-medium", STATUS_COLOR[run.status])}>
        {busy && <Loader2 size={11} className="animate-spin" />}
        {STATUS_LABEL[run.status]}
      </span>
      {run.maxCycles > 0 && run.currentCycle > 0 && (
        <span className="text-[var(--muted-foreground)]">
          Cycle {run.currentCycle} / {run.maxCycles}
        </span>
      )}
      {run.sessionId && (
        <span className="ml-auto font-mono text-[10px] text-[var(--muted-foreground)]">
          session {run.sessionId.slice(0, 8)}
        </span>
      )}
    </div>
  );
}
