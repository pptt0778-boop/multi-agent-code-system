"use client";

import { useState } from "react";
import { Code2, Eye, GitBranch, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditorTab } from "@/components/workspace/editor-tab";
import { TerminalTab } from "@/components/workspace/terminal-tab";
import { PreviewTab } from "@/components/workspace/preview-tab";
import { GitTab } from "@/components/workspace/git-tab";

type TabId = "editor" | "terminal" | "preview" | "git";

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: "editor", label: "Code", icon: <Code2 size={13} /> },
  { id: "terminal", label: "Terminal", icon: <TerminalSquare size={13} /> },
  { id: "preview", label: "Preview", icon: <Eye size={13} /> },
  { id: "git", label: "Git", icon: <GitBranch size={13} /> },
];

export function WorkspacePanel() {
  const [tab, setTab] = useState<TabId>("editor");

  return (
    <section className="flex w-[46%] min-w-[380px] shrink-0 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-[var(--border)] px-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition",
              tab === t.id
                ? "bg-white/10 text-foreground"
                : "text-[var(--muted-foreground)] hover:text-foreground",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {tab === "editor" && <EditorTab />}
        {tab === "terminal" && <TerminalTab />}
        {tab === "preview" && <PreviewTab />}
        {tab === "git" && <GitTab />}
      </div>
    </section>
  );
}
