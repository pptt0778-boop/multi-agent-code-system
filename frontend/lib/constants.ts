import type { ModelOption, Skill } from "@/types";

export const MODELS: ModelOption[] = [
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "anthropic", contextWindow: 200_000 },
  { id: "claude-opus-4-1", label: "Claude Opus 4.1", provider: "anthropic", contextWindow: 200_000 },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", contextWindow: 128_000 },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", contextWindow: 128_000 },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google", contextWindow: 1_000_000 },
  { id: "deepseek-chat", label: "DeepSeek V3", provider: "deepseek", contextWindow: 64_000 },
];

export const DEFAULT_SKILLS: Skill[] = [
  {
    id: "solid-principles",
    name: "SOLID Principles",
    description: "Enforce SOLID design, clean modular architecture in generated code.",
    promptTemplate:
      "All generated code must follow SOLID principles: single-responsibility modules, dependency injection over globals, and explicit interfaces.",
    enabled: true,
  },
  {
    id: "next-app-router",
    name: "Next.js App Router",
    description: "Optimize frontend code for Next.js App Router conventions.",
    promptTemplate:
      "When generating Next.js code, use the App Router: server components by default, 'use client' only where needed, route handlers for APIs.",
    enabled: false,
  },
  {
    id: "typed-everything",
    name: "Strict Typing",
    description: "Require full type annotations — no `any`, strict null checks.",
    promptTemplate:
      "All code must be fully typed. TypeScript strict mode rules apply; avoid `any`; Python code must include type hints.",
    enabled: true,
  },
];

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const CONTEXT_WARNING_THRESHOLD = 0.75;
