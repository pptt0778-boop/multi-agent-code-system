"""Multi-provider LLM proxy built on LiteLLM (Phase 1.1).

Features:
  - per-request API key injection (client key > vault key > env key)
  - automatic fallback chain on rate-limit / context-window errors
  - cumulative token accounting for the context-safeguard protocol
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

import litellm

from app.config import get_settings
from app.services import vault

litellm.suppress_debug_info = True

# Model -> provider routing hints for LiteLLM
MODEL_PREFIX: dict[str, str] = {
    "claude": "anthropic/",
    "gpt": "openai/",
    "gemini": "gemini/",
    "deepseek": "deepseek/",
}

# Ordered fallback chain if the primary model rate-limits or overflows.
FALLBACK_CHAIN: list[str] = ["gpt-4o-mini", "gemini/gemini-2.0-flash"]


def resolve_model(model: str) -> str:
    if "/" in model:
        return model  # already provider-prefixed
    for stem, prefix in MODEL_PREFIX.items():
        if model.startswith(stem):
            return f"{prefix}{model}"
    return model


def resolve_api_key(model: str, client_key: str | None = None) -> str | None:
    if client_key:
        return client_key
    provider = model.split("/", 1)[0] if "/" in model else ""
    settings = get_settings()
    return vault.get_key(provider) or settings.provider_key(provider) or None


@dataclass
class TokenMeter:
    """Cumulative token accounting across agent turns (Phase 4.1)."""

    total: int = 0
    per_turn: list[int] = field(default_factory=list)

    def record(self, usage: Any) -> int:
        used = 0
        if usage is not None:
            used = int(getattr(usage, "total_tokens", 0) or 0)
        self.per_turn.append(used)
        self.total += used
        return used


async def complete(
    model: str,
    messages: list[dict[str, str]],
    *,
    client_key: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 8192,
) -> tuple[str, int]:
    """Run a chat completion with fallback. Returns (text, tokens_used)."""
    candidates = [resolve_model(model), *FALLBACK_CHAIN]
    last_error: Exception | None = None

    for candidate in candidates:
        try:
            response = await asyncio.wait_for(
                litellm.acompletion(
                    model=candidate,
                    messages=messages,
                    api_key=resolve_api_key(candidate, client_key),
                    temperature=temperature,
                    max_tokens=max_tokens,
                ),
                timeout=180,
            )
            text = response.choices[0].message.content or ""
            tokens = int(getattr(response.usage, "total_tokens", 0) or 0)
            return text, tokens
        except (
            litellm.RateLimitError,
            litellm.ContextWindowExceededError,
            litellm.ServiceUnavailableError,
            asyncio.TimeoutError,
        ) as exc:  # transient -> try fallback
            last_error = exc
            continue

    raise RuntimeError(
        f"All LLM candidates failed (primary={model}): {last_error}"
    )
