"""Agent 1 — Coder / Builder (Phase 2.1).

Produces complete, executable code. Output contract is strict JSON so the
orchestrator can update the workspace deterministically.
"""

from __future__ import annotations

import json
from typing import Optional

from app.models.schemas import JudgeVerdict, WorkspaceFile

CODER_SYSTEM_PROMPT = """You are AGENT 1 (Coder / Builder) in a dual-agent coding system.

FOCUS: high-performance, clean, modular code following SOLID principles.
OBJECTIVE: transform the user's requirement into a complete, executable solution.

OUTPUT CONTRACT — respond with STRICT JSON ONLY, no prose, no markdown fences:
{
  "summary": "<one-paragraph explanation of the implementation>",
  "files": [
    {"path": "<relative/path>", "content": "<full file content>",
     "language": "<python|typescript|javascript|go|rust|bash|html|css>"}
  ],
  "entry_command": "<optional explicit run/test command, e.g. 'python main.py' or 'pytest -q'>"
}

RULES:
- Include ALL files needed to run and verify the solution (tests included).
- Code must be complete — no placeholders, no TODOs.
- When you receive a Judge report, fix every listed error, then return the
  FULL updated file set (not a diff).
"""


def build_coder_messages(
    task: str,
    skills: list[str],
    feedback: Optional[JudgeVerdict] = None,
    current_files: Optional[list[WorkspaceFile]] = None,
    deep_search_notes: Optional[str] = None,
) -> list[dict[str, str]]:
    parts: list[str] = [f"USER TASK:\n{task}"]

    if skills:
        parts.append("ACTIVE SKILL RULES (must obey):\n- " + "\n- ".join(skills))

    if deep_search_notes:
        parts.append(f"DEEP SEARCH CONTEXT:\n{deep_search_notes}")

    if current_files:
        listing = "\n\n".join(
            f"--- {f.path} ---\n{f.content}" for f in current_files
        )
        parts.append(f"CURRENT WORKSPACE FILES:\n{listing}")

    if feedback is not None:
        issues = "\n".join(
            f"- [{i.severity.upper()}] {i.file or 'general'}: {i.message}"
            for i in feedback.issues
        )
        parts.append(
            f"JUDGE REPORT (cycle {feedback.cycle}, score {feedback.score}/100):\n"
            f"{issues or '- no structured issues'}\n\n"
            f"JUDGE FEEDBACK:\n{feedback.feedback}\n\n"
            "Fix every error and return the FULL updated file set."
        )

    return [
        {"role": "system", "content": CODER_SYSTEM_PROMPT},
        {"role": "user", "content": "\n\n".join(parts)},
    ]


def parse_coder_output(raw: str) -> tuple[str, list[WorkspaceFile], Optional[str]]:
    """Parse the Coder's JSON response. Tolerant of accidental fences."""
    text = raw.strip()
    if text.startswith("```"):
        # strip markdown fences if the model added them anyway
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        # fallback: treat whole response as a single python file
        return (
            "Unstructured coder output captured verbatim.",
            [WorkspaceFile(path="output.txt", content=raw, language="plaintext")],
            None,
        )

    files = [
        WorkspaceFile(
            path=str(f.get("path", f"file_{i}.txt")),
            content=str(f.get("content", "")),
            language=str(f.get("language", "plaintext")),
        )
        for i, f in enumerate(payload.get("files", []))
    ]
    summary = str(payload.get("summary", ""))
    entry = payload.get("entry_command")
    return summary, files, str(entry) if entry else None
