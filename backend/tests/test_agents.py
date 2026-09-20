"""Unit tests for agent output parsing (Phase 2 contracts).

Run: pytest tests/ -v   (requires: pip install pytest)
"""

from app.agents.coder import parse_coder_output
from app.agents.judge import parse_judge_output
from app.models.schemas import SandboxResult


def test_parse_coder_output_clean_json():
    raw = '{"summary": "adds fizzbuzz", "files": [{"path": "main.py", "content": "print(1)", "language": "python"}], "entry_command": "python main.py"}'
    summary, files, entry = parse_coder_output(raw)
    assert summary == "adds fizzbuzz"
    assert files[0].path == "main.py"
    assert files[0].language == "python"
    assert entry == "python main.py"


def test_parse_coder_output_with_markdown_fences():
    raw = '```json\n{"summary": "s", "files": [{"path": "a.py", "content": "x=1", "language": "python"}]}\n```'
    _, files, _ = parse_coder_output(raw)
    assert files[0].path == "a.py"


def test_parse_coder_output_unstructured_fallback():
    summary, files, entry = parse_coder_output("this is not json at all")
    assert files[0].path == "output.txt"
    assert entry is None
    assert "verbatim" in summary


def test_parse_judge_output_pass():
    sandbox = SandboxResult(exit_code=0, stdout="ok")
    raw = '{"passed": true, "score": 95, "issues": [], "feedback": "looks good"}'
    verdict = parse_judge_output(raw, cycle=1, sandbox=sandbox)
    assert verdict.passed is True
    assert verdict.score == 95


def test_judge_ground_truth_overrides_false_pass():
    """Sandbox failure must veto a mistaken LLM 'pass'."""
    sandbox = SandboxResult(exit_code=1, stderr="NameError: boom")
    raw = '{"passed": true, "score": 100, "issues": [], "feedback": "fine"}'
    verdict = parse_judge_output(raw, cycle=2, sandbox=sandbox)
    assert verdict.passed is False
    assert any(i.severity == "error" for i in verdict.issues)


def test_judge_timeout_vetoes_pass():
    sandbox = SandboxResult(exit_code=124, timed_out=True)
    raw = '{"passed": true, "score": 90, "issues": [], "feedback": ""}'
    verdict = parse_judge_output(raw, cycle=1, sandbox=sandbox)
    assert verdict.passed is False
    assert any("timed out" in i.message for i in verdict.issues)


def test_parse_judge_output_garbage():
    sandbox = SandboxResult(exit_code=0)
    verdict = parse_judge_output("not json", cycle=1, sandbox=sandbox)
    assert verdict.passed is False
