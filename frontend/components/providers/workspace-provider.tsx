"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { submitTask } from "@/lib/api";
import { DEFAULT_SKILLS, MODELS, CONTEXT_WARNING_THRESHOLD } from "@/lib/constants";
import { uid } from "@/lib/utils";
import type {
  ApiKeyEntry,
  ChatMessage,
  GitStatus,
  JudgeVerdict,
  RunState,
  Skill,
  TerminalLine,
  WorkspaceFile,
} from "@/types";

interface WorkspaceContextValue {
  apiKeys: ApiKeyEntry[];
  setApiKey: (provider: ApiKeyEntry["provider"], key: string) => void;
  model: string;
  setModel: (m: string) => void;
  skills: Skill[];
  addSkill: (skill: Omit<Skill, "id">) => void;
  toggleSkill: (id: string) => void;
  deepSearch: boolean;
  setDeepSearch: (v: boolean) => void;
  maxCycles: number;
  setMaxCycles: (n: number) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  run: RunState;
  messages: ChatMessage[];
  files: WorkspaceFile[];
  activeFile: string | null;
  setActiveFile: (p: string) => void;
  terminal: TerminalLine[];
  verdicts: JudgeVerdict[];
  git: GitStatus;
  busy: boolean;
  sendPrompt: (prompt: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const INITIAL_RUN: RunState = {
  status: "idle",
  currentCycle: 0,
  maxCycles: 3,
  tokensUsed: 0,
  contextLimit: 200_000,
  sessionId: null,
};

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [model, setModel] = useState(MODELS[0].id);
  const [skills, setSkills] = useState<Skill[]>(DEFAULT_SKILLS);
  const [deepSearch, setDeepSearch] = useState(false);
  const [maxCycles, setMaxCycles] = useState(3);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [run, setRun] = useState<RunState>(INITIAL_RUN);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [terminal, setTerminal] = useState<TerminalLine[]>([]);
  const [verdicts, setVerdicts] = useState<JudgeVerdict[]>([]);
  const [git] = useState<GitStatus>({
    branch: "main",
    repo: null,
    staged: [],
    pullRequestUrl: null,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("macs_api_keys");
      if (raw) setApiKeys(JSON.parse(raw) as ApiKeyEntry[]);
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const setApiKey = useCallback(
    (provider: ApiKeyEntry["provider"], key: string) => {
      setApiKeys((prev) => {
        const next = prev.filter((k) => k.provider !== provider);
        if (key) next.push({ provider, key });
        try {
          localStorage.setItem("macs_api_keys", JSON.stringify(next));
        } catch {
          /* storage unavailable */
        }
        return next;
      });
    },
    [],
  );

  const addSkill = useCallback((skill: Omit<Skill, "id">) => {
    setSkills((prev) => [...prev, { ...skill, id: uid() }]);
  }, []);

  const toggleSkill = useCallback((id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    );
  }, []);

  const sendPrompt = useCallback(
    async (prompt: string) => {
      if (busy || !prompt.trim()) return;
      setBusy(true);

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "user", content: prompt, timestamp: Date.now() },
      ]);
      setRun((prev) => ({
        ...prev,
        status: "coding",
        currentCycle: 0,
        maxCycles,
        contextLimit:
          MODELS.find((m) => m.id === model)?.contextWindow ?? prev.contextLimit,
      }));

      const activeKey = apiKeys.find(
        (k) => k.provider === MODELS.find((m) => m.id === model)?.provider,
      )?.key;

      try {
        await submitTask(
          {
            prompt,
            model,
            maxCycles,
            deepSearch,
            skills: skills.filter((s) => s.enabled).map((s) => s.promptTemplate),
            sessionId: run.sessionId,
            githubRepo: git.repo,
          },
          (e) => {
            switch (e.type) {
              case "agent_message":
                setMessages((prev) => [
                  ...prev,
                  {
                    id: uid(),
                    role: e.role ?? "system",
                    content: e.content ?? "",
                    cycle: e.cycle,
                    timestamp: Date.now(),
                  },
                ]);
                break;
              case "file_update":
                if (e.file) {
                  const f = e.file;
                  setFiles((prev) => {
                    const idx = prev.findIndex((p) => p.path === f.path);
                    if (idx >= 0) {
                      const next = [...prev];
                      next[idx] = f;
                      return next;
                    }
                    return [...prev, f];
                  });
                  setActiveFile((cur) => cur ?? f.path);
                }
                break;
              case "terminal":
                setTerminal((prev) => [
                  ...prev,
                  {
                    id: uid(),
                    stream: e.stream ?? "stdout",
                    text: e.line ?? "",
                    timestamp: Date.now(),
                  },
                ]);
                break;
              case "verdict":
                if (e.verdict) setVerdicts((prev) => [...prev, e.verdict!]);
                break;
              case "status":
                setRun((prev) => ({
                  ...prev,
                  status: e.status ?? prev.status,
                  currentCycle: e.cycle ?? prev.currentCycle,
                  tokensUsed: e.tokensUsed ?? prev.tokensUsed,
                  sessionId: e.sessionId ?? prev.sessionId,
                }));
                break;
              case "error":
                setMessages((prev) => [
                  ...prev,
                  {
                    id: uid(),
                    role: "system",
                    content: `⚠️ ${e.error ?? "Unknown backend error"}`,
                    timestamp: Date.now(),
                  },
                ]);
                setRun((prev) => ({ ...prev, status: "failed" }));
                break;
              case "done":
                setRun((prev) => ({ ...prev, status: "passed" }));
                break;
            }
          },
          activeKey,
        );
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "system",
            content: `Backend unreachable at ${
              process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
            }. Start the FastAPI server (uvicorn app.main:app) to run agents. (${
              err instanceof Error ? err.message : String(err)
            })`,
            timestamp: Date.now(),
          },
        ]);
        setRun((prev) => ({ ...prev, status: "idle" }));
      } finally {
        setBusy(false);
      }
    },
    [apiKeys, busy, deepSearch, git.repo, maxCycles, model, run.sessionId, skills],
  );

  const contextWarning =
    run.contextLimit > 0 &&
    run.tokensUsed / run.contextLimit > CONTEXT_WARNING_THRESHOLD;

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      apiKeys,
      setApiKey,
      model,
      setModel,
      skills,
      addSkill,
      toggleSkill,
      deepSearch,
      setDeepSearch,
      maxCycles,
      setMaxCycles,
      sidebarOpen,
      setSidebarOpen,
      run: { ...run, status: contextWarning ? "context_limit" : run.status },
      messages,
      files,
      activeFile,
      setActiveFile,
      terminal,
      verdicts,
      git,
      busy,
      sendPrompt,
    }),
    [
      apiKeys, setApiKey, model, skills, addSkill, toggleSkill, deepSearch,
      maxCycles, sidebarOpen, run, contextWarning, messages, files, activeFile,
      terminal, verdicts, git, busy, sendPrompt,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
