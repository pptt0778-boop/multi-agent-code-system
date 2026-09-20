"use client";

import dynamic from "next/dynamic";
import { FileCode2 } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { cn } from "@/lib/utils";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-[var(--muted-foreground)]">
      Loading editor…
    </div>
  ),
});

export function EditorTab() {
  const { files, activeFile, setActiveFile } = useWorkspace();
  const current = files.find((f) => f.path === activeFile) ?? files[0] ?? null;

  if (files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
        <FileCode2 size={28} strokeWidth={1.5} />
        <p className="text-xs">No files yet — agent output will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--border)] bg-black/20 px-2 py-1">
        {files.map((f) => (
          <button
            key={f.path}
            onClick={() => setActiveFile(f.path)}
            className={cn(
              "whitespace-nowrap rounded px-2 py-1 font-mono text-[10px] transition",
              current?.path === f.path
                ? "bg-white/10 text-foreground"
                : "text-[var(--muted-foreground)] hover:text-foreground",
            )}
          >
            {f.path}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        <MonacoEditor
          path={current?.path}
          language={current?.language ?? "typescript"}
          value={current?.content ?? ""}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            scrollBeyondLastLine: false,
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}
