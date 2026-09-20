"use client";

import { FolderGit2, Settings2 } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { formatTokens } from "@/lib/utils";

export function SettingsSection() {
  const { run, git } = useWorkspace();
  const pct = Math.min(100, Math.round((run.tokensUsed / run.contextLimit) * 100));

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Settings2 size={14} className="text-[var(--accent)]" />
        <h3 className="panel-title">System</h3>
      </div>

      <div className="panel flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--muted-foreground)]">Context usage</span>
          <span>
            {formatTokens(run.tokensUsed)} / {formatTokens(run.contextLimit)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background:
                pct > 75 ? "#ef4444" : pct > 50 ? "#f59e0b" : "var(--accent)",
            }}
          />
        </div>
        {pct > 75 && (
          <p className="text-[10px] text-red-400">
            Context limit approaching — automatic compression will trigger.
          </p>
        )}
      </div>

      <div className="panel flex items-center gap-2 p-3">
        <FolderGit2 size={14} className="text-[var(--muted-foreground)]" />
        <div className="flex flex-col">
          <span className="text-[11px] font-medium">
            {git.repo ?? "No repository connected"}
          </span>
          <span className="text-[10px] text-[var(--muted-foreground)]">
            branch: {git.branch}
          </span>
        </div>
      </div>
    </section>
  );
}
