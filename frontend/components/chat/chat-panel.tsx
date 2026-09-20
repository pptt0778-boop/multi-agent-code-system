"use client";

import { useEffect, useRef } from "react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ChatMessageItem } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { StatusBar } from "@/components/chat/status-bar";

export function ChatPanel() {
  const { messages } = useWorkspace();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <section className="flex min-w-0 flex-1 flex-col border-r border-[var(--border)]">
      <StatusBar />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium">Describe what you want to build</p>
            <p className="max-w-sm text-xs text-[var(--muted-foreground)]">
              The Coder agent will draft a solution; the Judge agent will execute
              it in the Docker sandbox and iterate until it passes — or your
              configured review-cycle budget is exhausted.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <ChatMessageItem key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>
      <ChatInput />
    </section>
  );
}
