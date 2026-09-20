"""Docker execution sandbox (Phases 1.2 & 5.1).

Security posture:
  - memory bound (default 512MB), no network, read-only root fs
  - non-root execution (nobody), all capabilities dropped
  - hard wall-clock timeout with container kill

If no Docker engine is reachable the service degrades to a local subprocess
executor so development on machines without Docker stays possible.
"""

from __future__ import annotations

import asyncio
import io
import logging
import shlex
import tarfile
import tempfile
import time
from pathlib import Path
from typing import AsyncIterator, Optional

from app.config import get_settings
from app.models.schemas import SandboxResult, WorkspaceFile

logger = logging.getLogger(__name__)

RUNTIME_IMAGES: dict[str, str] = {
    "python": "python:3.12-slim",
    "node": "node:22-alpine",
    "go": "golang:1.23-alpine",
    "rust": "rust:1.81-slim",
    "bash": "bash:5",
}

DEFAULT_COMMANDS: dict[str, str] = {
    ".py": "python {entry}",
    ".ts": "npx --yes tsx {entry}",
    ".js": "node {entry}",
    ".go": "go run {entry}",
    ".rs": "rustc {entry} -o /tmp/app && /tmp/app",
    ".sh": "bash {entry}",
}


def _docker_client():
    import docker

    settings = get_settings()
    if settings.docker_host:
        client = docker.DockerClient(base_url=settings.docker_host)
    else:
        client = docker.from_env()
    client.ping()
    return client


def docker_available() -> bool:
    try:
        _docker_client()
        return True
    except Exception:
        return False


def _make_tar(files: list[WorkspaceFile]) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as tar:
        for f in files:
            data = f.content.encode()
            info = tarfile.TarInfo(name=f.path.lstrip("/"))
            info.size = len(data)
            info.mode = 0o644
            tar.addfile(info, io.BytesIO(data))
    return buf.getvalue()


class Sandbox:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._client = None
        try:
            self._client = _docker_client()
        except Exception as exc:
            logger.warning("Docker unavailable, using subprocess fallback: %s", exc)

    @property
    def is_docker(self) -> bool:
        return self._client is not None

    async def run(
        self,
        files: list[WorkspaceFile],
        command: Optional[str] = None,
        runtime: str = "python",
        timeout: Optional[int] = None,
    ) -> SandboxResult:
        if self.is_docker:
            return await asyncio.to_thread(
                self._run_in_docker, files, command, runtime, timeout
            )
        return await self._run_subprocess(files, command, timeout)

    async def stream_run(
        self,
        files: list[WorkspaceFile],
        command: Optional[str] = None,
        runtime: str = "python",
        timeout: Optional[int] = None,
    ) -> AsyncIterator[tuple[str, str]]:
        """Yield (stream, line) pairs, then a final ('system', summary) line."""
        result = await self.run(files, command, runtime, timeout)
        for line in result.stdout.splitlines():
            yield ("stdout", line)
        for line in result.stderr.splitlines():
            yield ("stderr", line)
        yield (
            "system",
            f"[exit_code={result.exit_code} timed_out={result.timed_out} "
            f"duration={result.duration_s:.2f}s]",
        )

    # ------------------------------------------------------------------ docker

    def _run_in_docker(
        self,
        files: list[WorkspaceFile],
        command: Optional[str],
        runtime: str,
        timeout: Optional[int],
    ) -> SandboxResult:
        assert self._client is not None
        s = self.settings
        image = RUNTIME_IMAGES.get(runtime, RUNTIME_IMAGES["python"])
        cmd = command or self._default_command(files)
        started = time.monotonic()
        container = self._client.containers.create(
            image=image,
            command=["sh", "-c", cmd],
            working_dir="/workspace",
            mem_limit=f"{s.sandbox_memory_mb}m",
            network_mode=s.sandbox_network,
            user="nobody",
            cap_drop=["ALL"],
            security_opt=["no-new-privileges"],
            read_only=True,
            tmpfs={"/workspace": "rw,noexec,nosuid,size=64m", "/tmp": "rw,size=32m"},
            detach=True,
            tty=False,
        )
        try:
            container.put_archive("/workspace", _make_tar(files))
            container.start()
            try:
                rc = container.wait(timeout=timeout or s.sandbox_timeout_s)
                exit_code = int(rc.get("StatusCode", 1))
                timed_out = False
            except Exception:
                container.kill()
                exit_code, timed_out = 124, True
            stdout = container.logs(stdout=True, stderr=False).decode(
                "utf-8", "replace"
            )
            stderr = container.logs(stdout=False, stderr=True).decode(
                "utf-8", "replace"
            )
            return SandboxResult(
                exit_code=exit_code,
                stdout=stdout,
                stderr=stderr,
                timed_out=timed_out,
                duration_s=time.monotonic() - started,
            )
        finally:
            try:
                container.remove(force=True)
            except Exception:
                pass
    # -------------------------------------------------------------- subprocess

    async def _run_subprocess(
        self,
        files: list[WorkspaceFile],
        command: Optional[str],
        timeout: Optional[int],
    ) -> SandboxResult:
        s = self.settings
        started = time.monotonic()
        with tempfile.TemporaryDirectory(prefix="macs-sandbox-") as tmp:
            for f in files:
                dest = Path(tmp) / f.path.lstrip("/")
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(f.content, encoding="utf-8")
            cmd = command or self._default_command(files)
            try:
                proc = await asyncio.create_subprocess_shell(
                    cmd,
                    cwd=tmp,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                try:
                    out, err = await asyncio.wait_for(
                        proc.communicate(), timeout=timeout or s.sandbox_timeout_s
                    )
                    return SandboxResult(
                        exit_code=proc.returncode or 0,
                        stdout=out.decode("utf-8", "replace"),
                        stderr=err.decode("utf-8", "replace"),
                        duration_s=time.monotonic() - started,
                    )
                except asyncio.TimeoutError:
                    proc.kill()
                    return SandboxResult(
                        exit_code=124,
                        timed_out=True,
                        stderr="execution timed out",
                        duration_s=time.monotonic() - started,
                    )
            except FileNotFoundError as exc:
                return SandboxResult(exit_code=127, stderr=str(exc))

    # ------------------------------------------------------------------ helpers

    @staticmethod
    def _default_command(files: list[WorkspaceFile]) -> str:
        if not files:
            return "echo 'no files to execute'"
        entry = files[0].path.lstrip("/")
        template = DEFAULT_COMMANDS.get(Path(entry).suffix, "cat {entry}")
        return template.format(entry=shlex.quote(entry))
