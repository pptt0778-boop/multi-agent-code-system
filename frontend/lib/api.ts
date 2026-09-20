import { API_BASE_URL } from "@/lib/constants";
import type { AgentRole, JudgeVerdict, RunStatus, WorkspaceFile } from "@/types";

export interface TaskEvent {
  type:
    | "agent_message"
    | "file_update"
    | "terminal"
    | "verdict"
    | "status"
    | "done"
    | "error";
  role?: AgentRole;
  content?: string;
  file?: WorkspaceFile;
  line?: string;
  stream?: "stdout" | "stderr" | "system";
  verdict?: JudgeVerdict;
  status?: RunStatus;
  cycle?: number;
  tokensUsed?: number;
  sessionId?: string;
  error?: string;
}

export interface SubmitTaskPayload {
  prompt: string;
  model: string;
  maxCycles: number;
  deepSearch: boolean;
  skills: string[]; // prompt templates of enabled skills
  sessionId?: string | null;
  githubRepo?: string | null;
}

/**
 * POST /api/tasks then consume the Server-Sent-Events stream at
 * GET /api/tasks/{taskId}/stream, dispatching typed events to the handler.
 */
export async function submitTask(
  payload: SubmitTaskPayload,
  onEvent: (e: TaskEvent) => void,
  apiKey?: string,
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["X-Api-Key"] = apiKey;

  const res = await fetch(`${API_BASE_URL}/api/tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Task submission failed: ${res.status} ${res.statusText}`);
  }

  const { task_id: taskId } = (await res.json()) as { task_id: string };

  const stream = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/stream`, { headers });
  if (!stream.ok || !stream.body) {
    throw new Error("Failed to open task event stream");
  }

  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = chunk
        .split("\n")
        .find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      try {
        onEvent(JSON.parse(dataLine.slice(6)) as TaskEvent);
      } catch {
        // ignore malformed SSE payloads
      }
    }
  }
}

export async function validateApiKey(provider: string, key: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/keys/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
