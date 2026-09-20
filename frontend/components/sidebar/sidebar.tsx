"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ApiKeyManager } from "@/components/sidebar/api-key-manager";
import { ModelSelector } from "@/components/sidebar/model-selector";
import { SkillsManager } from "@/components/sidebar/skills-manager";
import { SettingsSection } from "@/components/sidebar/settings-section";

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useWorkspace();

  return (
    <div className="relative flex h-full shrink-0">
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex h-full flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--muted)]"
          >
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
              <span className="panel-title">Configuration</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-md p-1 text-[var(--muted-foreground)] transition hover:bg-white/5 hover:text-foreground"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
              <ApiKeyManager />
              <ModelSelector />
              <SkillsManager />
              <SettingsSection />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute left-2 top-3 z-10 rounded-md border border-[var(--border)] bg-[var(--muted)] p-1.5 text-[var(--muted-foreground)] transition hover:text-foreground"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen size={16} />
        </button>
      )}
    </div>
  );
}
