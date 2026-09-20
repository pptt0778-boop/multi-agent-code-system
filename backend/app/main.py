"""FastAPI application entrypoint.

Routers:
  /api/tasks  — submit agent tasks, consume SSE event streams
  /api/keys   — encrypted API-key vault management
  /api/health — liveness & capability probe
"""

from __future__ import annotations

import logging
import uuid
from typing import AsyncIterator, Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.config import get_settings
from app.models.schemas import SubmitTaskRequest, TaskEvent
from app.services import vault
from app.services.orchestrator import Orchestrator
from app.services.sandbox import docker_available

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Multi-Agent Code System", version="0.1.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_orchestrator: Optional[Orchestrator] = None


def get_orchestrator() -> Orchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = Orchestrator()
    return _orchestrator


# ---------------------------------------------------------------- health


@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "docker": docker_available(),
        "github": bool(settings.github_token),
        "providers": {
            p: bool(settings.provider_key(p) or vault.get_key(p))
            for p in ("openai", "anthropic", "google", "openrouter", "deepseek")
        },
    }


# ---------------------------------------------------------------- keys


class KeyPayload(BaseModel):
    provider: str
    key: str


@app.post("/api/keys/validate")
async def validate_key(payload: KeyPayload) -> dict:
    """Lightweight validation: non-empty + provider prefix sanity check."""
    prefixes = {
        "openai": ("sk-",),
        "anthropic": ("sk-ant-",),
        "google": ("AIza",),
        "openrouter": ("sk-or-",),
        "deepseek": ("sk-",),
    }
    valid = payload.key.startswith(prefixes.get(payload.provider, ("",)))
    return {"valid": valid}


@app.post("/api/keys")
async def store_key(payload: KeyPayload) -> dict:
    vault.store_key(payload.provider, payload.key)
    return {"stored": payload.provider, "masked": vault.mask_key(payload.key)}


@app.get("/api/keys")
async def list_keys() -> dict:
    return {"keys": vault.list_keys()}


@app.delete("/api/keys/{provider}")
async def delete_key(provider: str) -> dict:
    vault.delete_key(provider)
    return {"deleted": provider}


# ---------------------------------------------------------------- tasks


class TaskCreated(BaseModel):
    task_id: str


@app.post("/api/tasks", response_model=TaskCreated)
async def create_task(
    req: SubmitTaskRequest,
    x_api_key: Optional[str] = Header(default=None),
) -> TaskCreated:
    task_id = uuid.uuid4().hex[:12]
    # Stash request for the streaming endpoint (in-memory; swap for Redis in HA setups).
    _pending_tasks[task_id] = (req, x_api_key)
    return TaskCreated(task_id=task_id)


_pending_tasks: dict[str, tuple[SubmitTaskRequest, Optional[str]]] = {}


@app.get("/api/tasks/{task_id}/stream")
async def stream_task(task_id: str) -> StreamingResponse:
    pending = _pending_tasks.pop(task_id, None)
    if pending is None:
        raise HTTPException(status_code=404, detail="Unknown or expired task_id")
    req, client_key = pending

    async def event_source() -> AsyncIterator[str]:
        try:
            async for event in get_orchestrator().run_task(
                req, client_key=client_key
            ):
                yield event.sse()
        except Exception as exc:  # last-resort guard so the stream ends cleanly
            logger.exception("task %s crashed", task_id)
            yield TaskEvent(type="error", error=str(exc)).sse()

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
