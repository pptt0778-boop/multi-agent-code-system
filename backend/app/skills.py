"""Modular skill & tool plugin registry (Phase 6.1).

Skills are prompt-level rules injected into agent context; tools are
callable capabilities agents can invoke (web search, AST parse, ...).
Custom skills registered via the UI (+) menu arrive in SubmitTaskRequest.skills
and are merged into the Coder's prompt by the orchestrator.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable


@dataclass
class Tool:
    name: str
    description: str
    handler: Callable[..., Awaitable[Any]]


@dataclass
class SkillRegistry:
    tools: dict[str, Tool] = field(default_factory=dict)

    def register(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    async def invoke(self, name: str, **kwargs: Any) -> Any:
        if name not in self.tools:
            raise KeyError(f"Tool '{name}' is not registered")
        return await self.tools[name].handler(**kwargs)


registry = SkillRegistry()


# --- built-in tools -------------------------------------------------------


async def _web_search(query: str) -> str:
    """Deep-search tool (Phase 3.2 toggle). Requires a search API key."""
    import httpx

    from app.config import get_settings

    key = get_settings().openrouter_api_key  # placeholder provider-agnostic
    if not key:
        return "Web search unavailable: no search provider key configured."
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_redirect": 1},
        )
        data = resp.json()
        return str(data.get("AbstractText") or data.get("Heading") or "no result")


registry.register(
    Tool(
        name="web_search",
        description="Search the public web for current information.",
        handler=_web_search,
    )
)
