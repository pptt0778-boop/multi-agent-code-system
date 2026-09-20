"use client";

import { GitBranch, GitPullRequest, UploadCloud } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";

export function GitTab() {
  const { git, files, run } = useWorkspace();

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="panel flex items-center gap-2.5 p-3">
        <GitBranch size={14} className="text-[var(--accent)]" />
        <div className="flex flex-col">
          <span className="text-xs font-medium">
            {git.repo ?? "No repository connected"}
          </span>
          <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
            feature/ai-agent-{run.sessionId?.slice(0, 8) ?? "--------"}
          </span>
        </div>
      </div>

      <div className="panel flex flex-col gap-1.5 p-3">
        <span className="panel-title">Changed Files ({files.length})</span>
        {files.length === 0 ? (
          <p className="text-[11px] text-[var(--muted-foreground)]">
            No staged changes yet.
          </p>
        ) : (
          files.map((f) => (
            <div
              key={f.path}
              className="flex items-center justify-between rounded-md bg-black/30 px-2 py-1"
            >
              <span className="font-mono text-[11px]">{f.path}</span>
              <span className="text-[10px] text-emerald-400">modified</span>
            </div>
          ))
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <button
          disabled={!git.repo || files.length === 0}
          className="flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] py-2 text-xs font-medium transition hover:bg-white/5 disabled:opacity-40"
        >
          <UploadCloud size={14} />
          Commit &amp; Push
        </button>
        <button
          disabled={!git.repo || files.length === 0}
          className="flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] py-2 text-xs font-medium text-[var(--accent-foreground)] transition hover:brightness-110 disabled:opacity-40"
        >
          <GitPullRequest size={14} />
          Open Pull Request
        </button>
        <p className="text-center text-[10px] text-[var(--muted-foreground)]">
          Commit messages and PR summaries are authored by the Judge agent
          (Phase 5.2).
        </p>
      </div>
    </div>
  );
}
