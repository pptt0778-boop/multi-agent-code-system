"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, PlusCircle, Repeat } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { cn } from "@/lib/utils";

export function ExtensionMenu({ onClose }: { onClose: () => void }) {
  const { deepSearch, setDeepSearch, maxCycles, setMaxCycles, addSkill } =
    useWorkspace();
  const [skillForm, setSkillForm] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [skillDesc, setSkillDesc] = useState("");
  const [skillPrompt, setSkillPrompt] = useState("");

  const saveSkill = () => {
    if (!skillName.trim() || !skillPrompt.trim()) return;
    addSkill({
      name: skillName.trim(),
      description: skillDesc.trim() || "Custom user skill",
      promptTemplate: skillPrompt.trim(),
      enabled: true,
    });
    setSkillName("");
    setSkillDesc("");
    setSkillPrompt("");
    setSkillForm(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-11 left-0 z-30 w-72 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-2 shadow-2xl shadow-black/50"
    >
      {/* Add Custom Skill */}
      <button
        onClick={() => setSkillForm((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-white/5"
      >
        <PlusCircle size={14} className="shrink-0 text-[var(--accent)]" />
        <span className="flex flex-col">
          <span className="font-medium">Add Custom Skill</span>
          <span className="text-[10px] text-[var(--muted-foreground)]">
            Attach a prompt template / domain rule to the agents
          </span>
        </span>
      </button>

      <AnimatePresence>
        {skillForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 px-2.5 pb-2">
              <input
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="Skill name"
                className="rounded-md border border-[var(--border)] bg-black/30 px-2 py-1.5 text-[11px] outline-none focus:border-[var(--accent)]"
              />
              <input
                value={skillDesc}
                onChange={(e) => setSkillDesc(e.target.value)}
                placeholder="Short description"
                className="rounded-md border border-[var(--border)] bg-black/30 px-2 py-1.5 text-[11px] outline-none focus:border-[var(--accent)]"
              />
              <textarea
                value={skillPrompt}
                onChange={(e) => setSkillPrompt(e.target.value)}
                placeholder="Prompt template injected into agent context…"
                rows={3}
                className="resize-none rounded-md border border-[var(--border)] bg-black/30 px-2 py-1.5 text-[11px] outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={saveSkill}
                className="rounded-md bg-[var(--accent)] py-1.5 text-[11px] font-medium text-[var(--accent-foreground)] transition hover:brightness-110"
              >
                Register Skill
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deep Search toggle */}
      <button
        onClick={() => setDeepSearch(!deepSearch)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-white/5"
      >
        <Globe
          size={14}
          className={cn(
            "shrink-0",
            deepSearch ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]",
          )}
        />
        <span className="flex flex-1 flex-col">
          <span className="font-medium">Deep Web Search</span>
          <span className="text-[10px] text-[var(--muted-foreground)]">
            Index web &amp; repo context before coding
          </span>
        </span>
        <span
          className={cn(
            "relative h-4 w-7 rounded-full transition",
            deepSearch ? "bg-[var(--accent)]" : "bg-zinc-700",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
              deepSearch ? "left-3.5" : "left-0.5",
            )}
          />
        </span>
      </button>

      {/* Review cycles */}
      <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs">
        <Repeat size={14} className="shrink-0 text-[var(--accent)]" />
        <span className="flex flex-1 flex-col">
          <span className="font-medium">Review Cycles</span>
          <span className="text-[10px] text-[var(--muted-foreground)]">
            Max Coder⇄Judge iterations (1–10)
          </span>
        </span>
        <span className="w-5 text-right font-mono text-[11px]">{maxCycles}</span>
      </div>
      <div className="px-2.5 pb-1.5">
        <input
          type="range"
          min={1}
          max={10}
          value={maxCycles}
          onChange={(e) => setMaxCycles(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
      </div>

      <button
        onClick={onClose}
        className="mt-1 w-full rounded-lg border border-[var(--border)] py-1.5 text-[11px] text-[var(--muted-foreground)] transition hover:bg-white/5"
      >
        Close
      </button>
    </motion.div>
  );
}
