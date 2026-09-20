"""Dual-agent N-cycle orchestrator (Phase 2.2).

Workflow per task:
  1. Coder drafts the initial implementation.
  2. Judge executes it in the sandbox and emits a structured verdict.
  3. While failed and cycle < max_cycles: feedback -> Coder refactor -> repeat.
  4. On pass (or budget exhaustion): emit final payload (+ optional GitHub PR).

Every step streams TaskEvent SSE frames to the frontend workspace.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import AsyncIterator, Optional

from app.agents import (
    build_coder_messages,
    build_judge_messages,
    parse_coder_output,
    parse_judge_output,
)
from app.models.schemas import (
    RunStatus,
    SubmitTaskRequest,
    TaskEvent,
    WorkspaceFile,
)
from app.services import llm
from app.services.context_guard import ContextGuard
from app.services.sandbox import Sandbox

logger = logging.getLogger(__name__)

MODEL_CONTEXT_WINDOWS: dict[str, int] = {
    "claude": 200_000,
    "gpt": 128_000,
    "gemini": 1_000_000,
    "deepseek": 64_000,
}


def _context_window(model: str) -> int:
    for stem, window in MODEL_CONTEXT_WINDOWS.items():
        if model.startswith(stem):
            return window
    return 128_000


class Orchestrator:
    def __init__(self, sandbox: Optional[Sandbox] = None) -> None:
        self.sandbox = sandbox or Sandbox()

    async def run_task(
        self,
        req: SubmitTaskRequest,
        *,
        client_key: Optional[str] = None,
    ) -> AsyncIterator[TaskEvent]:
        session_id = req.session_id or uuid.uuid4().hex[:12]
        guard = ContextGuard(
            session_id=session_id, context_limit=_context_window(req.model)
        )
        yield TaskEvent(
            type="status", status=RunStatus.CODING, cycle=0, session_id=session_id
        )

        feedback = None
        files: list[WorkspaceFile] = []
        unresolved: list[str] = []

        for cycle in range(1, req.max_cycles + 1):
            # ---------------- Phase 4.1: context safeguard ----------------
            if guard.maybe_compress("coder-refine", req.prompt, files, unresolved):
                yield TaskEvent(
                    type="status",
                    status=RunStatus.CONTEXT_LIMIT,
                    cycle=cycle,
                    session_id=session_id,
                )
                if guard.snapshot is not None:
                    yield TaskEvent(
                        type="agent_message",
                        role="system",
                        content=guard.snapshot.to_marker(),
                        cycle=cycle,
                    )

            # ---------------- Step 2: Coder turn ----------------
            yield TaskEvent(
                type="status", status=RunStatus.CODING, cycle=cycle,
                session_id=session_id, tokens_used=guard.tokens_used,
            )
            coder_msgs = build_coder_messages(
                task=req.prompt,
                skills=req.skills,
                feedback=feedback,
                current_files=files or None,
            )
            try:
                raw, tokens = await llm.complete(
                    req.model, guard.history + coder_msgs, client_key=client_key
                )
            except Exception as exc:
                yield TaskEvent(type="error", error=str(exc), cycle=cycle)
                return
            guard.record_turn(tokens)

            summary, files, entry_cmd = parse_coder_output(raw)
            yield TaskEvent(
                type="agent_message", role="coder", content=summary, cycle=cycle
            )
            for f in files:
                yield TaskEvent(type="file_update", file=f, cycle=cycle)

            # ---------------- Step 3: Judge executes & evaluates ----------------
            yield TaskEvent(
                type="status", status=RunStatus.EXECUTING, cycle=cycle,
                session_id=session_id, tokens_used=guard.tokens_used,
            )
            async for stream, line in self.sandbox.stream_run(files, entry_cmd):
                yield TaskEvent(
                    type="terminal",
                    stream=stream,  # type: ignore[arg-type]
                    line=line,
                    cycle=cycle,
                )
            result = await self.sandbox.run(files, entry_cmd)

            yield TaskEvent(
                type="status", status=RunStatus.REVIEWING, cycle=cycle,
                session_id=session_id, tokens_used=guard.tokens_used,
            )
            judge_msgs = build_judge_messages(req.prompt, files, result, cycle)
            try:
                jraw, jtokens = await llm.complete(
                    req.model, judge_msgs, client_key=client_key
                )
            except Exception as exc:
                yield TaskEvent(type="error", error=str(exc), cycle=cycle)
                return
            guard.record_turn(jtokens)

            verdict = parse_judge_output(jraw, cycle, result)
            yield TaskEvent(type="verdict", verdict=verdict, cycle=cycle)
            yield TaskEvent(
                type="agent_message", role="judge",
                content=(
                    f"Verdict: {'PASS' if verdict.passed else 'FAIL'} "
                    f"(score {verdict.score}/100)\n{verdict.feedback}"
                ),
                cycle=cycle,
            )

            # ---------------- Step 4: loop control ----------------
            if verdict.passed:
                yield TaskEvent(
                    type="status", status=RunStatus.PASSED, cycle=cycle,
                    session_id=session_id, tokens_used=guard.tokens_used,
                )
                break
            unresolved = [i.message for i in verdict.issues if i.severity == "error"]
            feedback = verdict
            if cycle < req.max_cycles:
                yield TaskEvent(
                    type="agent_message", role="system",
                    content=(
                        f"Cycle {cycle} failed — feeding structured report "
                        "back to Coder."
                    ),
                    cycle=cycle,
                )
        else:
            yield TaskEvent(
                type="agent_message", role="system",
                content=(
                    f"Max review cycles ({req.max_cycles}) reached — "
                    "delivering best-effort solution."
                ),
            )

        # ---------------- Step 5: optional GitHub PR (Phase 5.2) ----------------
        if req.github_repo:
            async for ev in self._push_to_github(req, files, session_id):
                yield ev

        yield TaskEvent(
            type="done", session_id=session_id, tokens_used=guard.tokens_used
        )

    # -------------------------------------------------------------- github

    async def _push_to_github(
        self,
        req: SubmitTaskRequest,
        files: list[WorkspaceFile],
        session_id: str,
    ) -> AsyncIterator[TaskEvent]:
        from app.services.github import GitHubService, GitHubUnavailable

        try:
            gh = GitHubService()
            pr_url = await asyncio.to_thread(
                gh.commit_and_open_pr,
                repo_name=req.github_repo or "",
                files=files,
                branch=f"feature/ai-agent-{session_id}",
                commit_message=(
                    f"feat: AI agent solution ({req.max_cycles} max cycles)\n\n"
                    f"Task: {req.prompt[:120]}"
                ),
                pr_title=f"[AI] {req.prompt[:72]}",
                pr_body=(
                    "Automated by the Multi-Agent Code System.\n\n"
                    f"**Task:** {req.prompt}\n\n"
                    f"Cycles used: \u2264 {req.max_cycles}. "
                    "Reviewed by the Judge agent in the Docker sandbox."
                ),
            )
            yield TaskEvent(
                type="agent_message", role="system",
                content=f"Pull request opened: {pr_url}",
            )
        except GitHubUnavailable as exc:
            yield TaskEvent(
                type="agent_message", role="system",
                content=f"GitHub integration skipped: {exc}",
            )
        except Exception as exc:
            logger.exception("GitHub push failed")
            yield TaskEvent(type="error", error=f"GitHub push failed: {exc}")
