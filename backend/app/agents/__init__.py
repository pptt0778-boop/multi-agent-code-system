"""Dual-agent definitions (Phase 2.1)."""

from app.agents.coder import CODER_SYSTEM_PROMPT, build_coder_messages, parse_coder_output
from app.agents.judge import JUDGE_SYSTEM_PROMPT, build_judge_messages, parse_judge_output

__all__ = [
    "CODER_SYSTEM_PROMPT",
    "JUDGE_SYSTEM_PROMPT",
    "build_coder_messages",
    "parse_coder_output",
    "build_judge_messages",
    "parse_judge_output",
]
