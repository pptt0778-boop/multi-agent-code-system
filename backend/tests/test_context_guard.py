"""Tests for the Phase 4 context-window safeguard."""

from app.models.schemas import WorkspaceFile
from app.services.context_guard import ContextGuard


def test_no_compression_below_threshold():
    guard = ContextGuard(session_id="s1", context_limit=1000)
    guard.record_turn(500)
    fired = guard.maybe_compress("phase", "task", [], [])
    assert fired is False
    assert guard.snapshot is None


def test_compression_at_75_percent():
    guard = ContextGuard(session_id="s1", context_limit=1000)
    guard.history = [{"role": "user", "content": "step one"}]
    guard.record_turn(760)
    fired = guard.maybe_compress(
        "coder-refine",
        "build a thing",
        [WorkspaceFile(path="main.py", content="x", language="python")],
        ["bug A"],
    )
    assert fired is True
    assert guard.snapshot is not None
    assert "main.py" in guard.snapshot.active_files
    assert "bug A" in guard.snapshot.unresolved_bugs
    assert guard.tokens_used == 0  # meter reset after compression
    assert "CONTINUE_SESSION" in guard.history[0]["content"]
    assert "CONTEXT_LIMIT_REACHED" in guard.snapshot.to_marker()
