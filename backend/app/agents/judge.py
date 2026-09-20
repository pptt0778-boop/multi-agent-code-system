"""Agent 2 — Judge / Reviewer / Evaluator (Phase 2.1).

Audits code, correlates sandbox execution results, and emits a structured
pass/fail verdict that feeds back into the Coder's next iteration.
"""

from __future__ import annotations

import json

from app.models.schemas import Issue, JudgeVerdict, SandboxResult, WorkspaceFile

JUDGE_SYSTEM_PROMPT = """You are AGENT 2 (Judge / Reviewer / Evaluator) in a dual-agent coding system.

FOCUS: security auditing, syntax correctness, runtime verification,
performance, and edge-case coverage.
OBJECTIVE: given the code AND its real sandbox execution result, decide
pass/fail and produce an actionable, structured bug report for the Coder.

OUTPUT CONTRACT — respond with STRICT JSON ONLY, no prose, no markdown fences:
{
  "passed": <true|false>,
  "score": <integer 0-100>,
  "issues": [
    {"severity": "error|warning|info", "message": "<actionable detail>",
     "file": "<path or null>"}
  ],
  "feedback": "<concise instructions telling the Coder exactly what to fix>"
}

RULES:
- exit_code != 0 or a timeout means NOT passed.
- Every runtime/syntax failure MUST appear as an "error" issue naming the file.
- "passed": true requires exit_code == 0 AND no error-severity issues.
"""


def build_judge_messages(
    task: str,
    files: list[WorkspaceFile],
    sandbox: SandboxResult,
    cycle: int,
) -> list[dict[str, str]]:
    listing = "\n\n".join(f"--- {f.path} ---\n{f.content}" for f in files)
    user = (
        f"ORIGINAL USER TASK:\n{task}\n\n"
        f"CANDIDATE FILES (cycle {cycle}):\n{listing}\n\n"
        f"SANDBOX EXECUTION RESULT:\n"
        f"exit_code={sandbox.exit_code} timed_out={sandbox.timed_out} "
        f"duration={sandbox.duration_s:.2f}s\n"
        f"--- stdout ---\n{sandbox.stdout[-4000:]}\n"
        f"--- stderr ---\n{sandbox.stderr[-4000:]}\n\n"
        "Evaluate and respond with the strict JSON verdict."
    )
    return [
        {"role": "system", "content": JUDGE_SYSTEM_PROMPT},
        {"role": "user", "content": user},
    ]


def parse_judge_output(raw: str, cycle: int, sandbox: SandboxResult) -> JudgeVerdict:
    """Parse Judge JSON; enforce the sandbox ground truth regardless."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        payload = json.loads(text)
        issues = [
            Issue(
                severity=i.get("severity", "info"),
                message=str(i.get("message", "")),
                file=i.get("file"),
            )
            for i in payload.get("issues", [])
        ]
        verdict = JudgeVerdict(
            cycle=cycle,
            passed=bool(payload.get("passed", False)),
            score=max(0, min(100, int(payload.get("score", 0)))),
            issues=issues,
            feedback=str(payload.get("feedback", "")),
        )
    except (json.JSONDecodeError, ValueError, AttributeError):
        verdict = JudgeVerdict(
            cycle=cycle,
            passed=False,
            score=0,
            issues=[Issue(severity="error", message="Judge produced unparseable output")],
            feedback=raw[:2000],
        )

    # Ground-truth enforcement: sandbox failure can never be a pass.
    if sandbox.exit_code != 0 or sandbox.timed_out:
        verdict.passed = False
        if sandbox.timed_out:
            verdict.issues.append(
                Issue(severity="error", message="Execution timed out in sandbox")
            )
        if not any(i.severity == "error" for i in verdict.issues):
            verdict.issues.append(
                Issue(
                    severity="error",
                    message=f"Sandbox exit code {sandbox.exit_code}: "
                    f"{sandbox.stderr[-500:]}",
                )
            )
    return verdict
