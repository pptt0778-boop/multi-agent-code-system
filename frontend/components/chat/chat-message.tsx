"use client";

import { motion } from "framer-motion";
import { Bot, Gavel, Info, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";

const ROLE_META: Record<
  ChatMessage["role"],
  { label: string; icon: React.ReactNode; className: string }
> = {
  user: {
    label: "You",
    icon: <User size={12} />,
    className: "border-white/15 bg-white/5",
  },
  coder: {
    label: "Coder",
    icon: <Bot size={12} />,
    className: "border-[var(--coder)]/40 bg-[var(--coder)]/5",
  },
  judge: {
    label: "Judge",
    icon: <Gavel size={12} />,
    className: "border-[var(--judge)]/40 bg-[var(--judge)]/5",
  },
  system: {
    label: "System",
    icon: <Info size={12} />,
    className: "border-[var(--border)] bg-black/30",
  },
};

export function ChatMessageItem({ message }: { message: ChatMessage }) {
  const meta = ROLE_META[message.role];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn("rounded-xl border p-3", meta.className)}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        {meta.icon}
        <span>{meta.label}</span>
        {message.cycle !== undefined && message.cycle > 0 && (
          <span className="rounded-full border border-[var(--border)] px-1.5 py-px">
            cycle {message.cycle}
          </span>
        )}
        <span className="ml-auto font-normal normal-case tracking-normal">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="whitespace-pre-wrap text-[13px] leading-relaxed">
        {message.content}
      </div>
    </motion.div>
  );
}
