"use client";

import { useEffect, useRef } from "react";
import { TerminalSquare } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { cn } from "@/lib/utils";

export function TerminalTab() {
  const { terminal } = useWorkspace();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminal.length]);

  if (terminal.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--muted-foreground)]">
        <TerminalSquare size={28} strokeWidth={1.5} />
        <p className="text-xs">Docker sandbox output streams here.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-black/40 p-3 font-mono text-[11px] leading-relaxed">
      {terminal.map((l) => (
        <div
          key={l.id}
          className={cn(
            "whitespace-pre-wrap",
            l.stream === "stderr" && "text-red-400",
            l.stream === "stdout" && "text-emerald-300/90",
            l.stream === "system" && "text-[var(--muted-foreground)]",
          )}
        >
          <span className="mr-2 select-none opacity-40">
            {new Date(l.timestamp).toLocaleTimeString()}
          </span>
          {l.text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
