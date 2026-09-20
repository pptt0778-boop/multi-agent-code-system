/** Core domain types shared across the multi-agent workspace UI. */

export type LLMProvider = "openai" | "anthropic" | "google" | "openrouter" | "deepseek";

export interface ApiKeyEntry {
  provider: LLMProvider;
  key: string; // stored locally; masked in UI
}

export interface ModelOption {
  id: string;
  label: string;
  provider: LLMProvider;
  contextWindow: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  promptTemplate: string;
  enabled: boolean;
}

export type AgentRole = "coder" | "judge" | "system" | "user";

export interface ChatMessage {
  id: string;
  role: AgentRole;
  content: string;
  cycle?: number;
  timestamp: number;
}

export interface WorkspaceFile {
  path: string;
  content: string;
  language: string;
}

export interface TerminalLine {
  id: string;
  stream: "stdout" | "stderr" | "system";
  text: string;
  timestamp: number;
}

export type RunStatus =
  | "idle"
  | "coding"
  | "reviewing"
  | "executing"
  | "passed"
  | "failed"
  | "context_limit";

export interface RunState {
  status: RunStatus;
  currentCycle: number;
  maxCycles: number;
  tokensUsed: number;
  contextLimit: number;
  sessionId: string | null;
}

export interface JudgeVerdict {
  cycle: number;
  passed: boolean;
  score: number; // 0-100
  issues: Array<{ severity: "error" | "warning" | "info"; message: string; file?: string }>;
  feedback: string;
}

export interface GitStatus {
  branch: string;
  repo: string | null;
  staged: string[];
  pullRequestUrl: string | null;
}
