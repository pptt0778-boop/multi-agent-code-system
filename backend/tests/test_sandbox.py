"""Sandbox fallback-executor tests (run without Docker)."""

import pytest

from app.models.schemas import WorkspaceFile
from app.services.sandbox import Sandbox


@pytest.mark.asyncio
async def test_subprocess_fallback_executes_python():
    sandbox = Sandbox()
    if sandbox.is_docker:
        pytest.skip("docker available — fallback path not exercised")
    files = [WorkspaceFile(path="main.py", content="print('hello-sandbox')", language="python")]
    result = await sandbox.run(files)
    # python may not exist on this host; accept either success or 127
    assert result.exit_code in (0, 127)
    if result.exit_code == 0:
        assert "hello-sandbox" in result.stdout


def test_default_command_mapping():
    files = [WorkspaceFile(path="app/main.py", content="x", language="python")]
    cmd = Sandbox._default_command(files)
    assert cmd.startswith("python ")
    assert "app/main.py" in cmd
