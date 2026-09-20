"use client";

import { useState } from "react";
import { Plus, SendHorizonal } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ExtensionMenu } from "@/components/chat/extension-menu";

export function ChatInput() {
  const { sendPrompt, busy, deepSearch, maxCycles } = useWorkspace();
  const [value, setValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const submit = async () => {
    const prompt = value.trim();
    if (!prompt || busy) return;
    setValue("");
    await sendPrompt(prompt);
  };

  return (
    <div className="shrink-0 border-t border-[var(--border)] p-3">
      <div className="panel relative flex items-end gap-2 p-2">
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--muted-foreground)] transition hover:border-[var(--accent)] hover:text-foreground"
            aria-label="Open extension menu"
          >
            <Plus size={16} />
          </button>
          {menuOpen && <ExtensionMenu onClose={() => setMenuOpen(false)} />}
        </div>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={2}
          placeholder="Describe the feature, bug, or refactor…"
          className="min-w-0 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm outline-none placeholder:text-[var(--muted-foreground)]"
        />
        <button
          onClick={() => void submit()}
          disabled={busy || !value.trim()}
          className="rounded-lg bg-[var(--accent)] p-2 text-[var(--accent-foreground)] transition hover:brightness-110 disabled:opacity-40"
          aria-label="Send"
        >
          <SendHorizonal size={16} />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-3 px-1 text-[10px] text-[var(--muted-foreground)]">
        <span>{maxCycles} review cycle{maxCycles > 1 ? "s" : ""}</span>
        {deepSearch && <span className="text-[var(--accent)]">deep search on</span>}
        <span className="ml-auto">Enter to send · Shift+Enter newline</span>
      </div>
    </div>
  );
}
