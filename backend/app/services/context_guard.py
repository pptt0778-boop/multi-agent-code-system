"""Context-window safeguard & session snapshots (Phase 4).

Tracks cumulative token usage; when usage crosses 75% of the model's context
window, the conversation history is compressed into a System State Snapshot
so the session can continue without hallucination or context loss.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.models.schemas import WorkspaceFile

WARNING_THRESHOLD = 0.75


@dataclass
class StateSnapshot:
    session_id: str
    phase: str
    completed_steps: list[str] = field(default_factory=list)
    unresolved_bugs: list[str] = field(default_factory=list)
    active_files: list[str] = field(default_factory=list)
    task: str = ""

    def to_marker(self) -> str:
        """The continuation marker from Phase 4.2."""
        return (
            f"[SYSTEM_STATE: CONTEXT_LIMIT_REACHED | PHASE: {self.phase} | "
            f"NEXT_STEP: {self.completed_steps[-1] if self.completed_steps else 'init'}]"
        )

    def to_messages(self) -> list[dict[str, str]]:
        return [
            {
                "role": "system",
                "content": (
                    "CONTINUE_SESSION — compressed state snapshot.\n"
                    f"Session: {self.session_id}\nPhase: {self.phase}\n"
                    f"Task: {self.task}\n"
                    f"Completed steps: {', '.join(self.completed_steps) or 'none'}\n"
                    f"Unresolved bugs: {', '.join(self.unresolved_bugs) or 'none'}\n"
                    f"Active code files: {', '.join(self.active_files) or 'none'}\n"
                    "Resume seamlessly from this snapshot."
                ),
            }
        ]


@dataclass
class ContextGuard:
    session_id: str
    context_limit: int
    tokens_used: int = 0
    history: list[dict[str, str]] = field(default_factory=list)
    snapshot: Optional[StateSnapshot] = None

    @property
    def ratio(self) -> float:
        return self.tokens_used / self.context_limit if self.context_limit else 0.0

    @property
    def limit_reached(self) -> bool:
        return self.ratio >= WARNING_THRESHOLD

    def record_turn(self, tokens: int) -> None:
        self.tokens_used += tokens

    def maybe_compress(
        self,
        phase: str,
        task: str,
        files: list[WorkspaceFile],
        unresolved: list[str],
    ) -> bool:
        """Compress history into a snapshot when over threshold. True if fired."""
        if not self.limit_reached:
            return False
        self.snapshot = StateSnapshot(
            session_id=self.session_id,
            phase=phase,
            completed_steps=[m["content"][:120] for m in self.history[-4:]],
            unresolved_bugs=unresolved,
            active_files=[f.path for f in files],
            task=task,
        )
        self.history = self.snapshot.to_messages()
        self.tokens_used = 0  # meter resets against the compressed history
        return True
