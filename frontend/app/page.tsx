import { Sidebar } from "@/components/sidebar/sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";

export default function Home() {
  return (
    <main className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">
              Multi-Agent Code System
            </span>
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              Coder в‡„ Judge
            </span>
          </div>
          <span className="text-xs text-[var(--muted-foreground)]">
            v0.1.0 вЂ” sandbox ready
          </span>
        </header>
        <div className="flex min-h-0 flex-1">
          <ChatPanel />
          <WorkspacePanel />
        </div>
      </div>
    </main>
  );
}
