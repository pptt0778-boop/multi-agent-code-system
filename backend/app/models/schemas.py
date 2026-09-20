"""Shared schemas between API, agents, and frontend SSE stream."""

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class RunStatus(str, Enum):
    IDLE = "idle"
    CODING = "coding"
    REVIEWING = "reviewing"
    EXECUTING = "executing"
    PASSED = "passed"
    FAILED = "failed"
    CONTEXT_LIMIT = "context_limit"


class WorkspaceFile(BaseModel):
    path: str
    content: str
    language: str = "plaintext"


class Issue(BaseModel):
    severity: Literal["error", "warning", "info"] = "info"
    message: str
    file: Optional[str] = None


class JudgeVerdict(BaseModel):
    cycle: int
    passed: bool
    score: int = Field(ge=0, le=100, default=0)
    issues: list[Issue] = Field(default_factory=list)
    feedback: str = ""


class SandboxResult(BaseModel):
    exit_code: int
    stdout: str = ""
    stderr: str = ""
    timed_out: bool = False
    duration_s: float = 0.0


class SubmitTaskRequest(BaseModel):
    prompt: str
    model: str = "claude-sonnet-4-5"
    max_cycles: int = Field(default=3, ge=1, le=10, alias="maxCycles")
    deep_search: bool = Field(default=False, alias="deepSearch")
    skills: list[str] = Field(default_factory=list)
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    github_repo: Optional[str] = Field(default=None, alias="githubRepo")

    model_config = {"populate_by_name": True}


class TaskEvent(BaseModel):
    """One SSE event pushed to the frontend workspace."""

    type: Literal[
        "agent_message", "file_update", "terminal", "verdict",
        "status", "done", "error",
    ]
    role: Optional[Literal["coder", "judge", "system", "user"]] = None
    content: Optional[str] = None
    file: Optional[WorkspaceFile] = None
    line: Optional[str] = None
    stream: Optional[Literal["stdout", "stderr", "system"]] = None
    verdict: Optional[JudgeVerdict] = None
    status: Optional[RunStatus] = None
    cycle: Optional[int] = None
    tokens_used: Optional[int] = Field(default=None, alias="tokensUsed")
    session_id: Optional[str] = Field(default=None, alias="sessionId")
    error: Optional[str] = None

    model_config = {"populate_by_name": True}

    def sse(self) -> str:
        return f"data: {self.model_dump_json(by_alias=True, exclude_none=True)}\n\n"
