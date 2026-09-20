"""GitHub integration core (Phases 1.3 & 5.2).

Branch creation, file writes, commits, and pull-request generation via the
Git Data API (blobs -> tree -> commit -> ref) using PyGithub.
"""

from __future__ import annotations

from app.config import get_settings
from app.models.schemas import WorkspaceFile


class GitHubUnavailable(RuntimeError):
    pass


class GitHubService:
    def __init__(self, token: str | None = None) -> None:
        settings = get_settings()
        self.token = token or settings.github_token
        if not self.token:
            raise GitHubUnavailable(
                "No GitHub token configured (set GITHUB_TOKEN or store one in the vault)."
            )
        from github import Github

        self._gh = Github(self.token)

    def commit_and_open_pr(
        self,
        *,
        repo_name: str,
        files: list[WorkspaceFile],
        branch: str,
        commit_message: str,
        pr_title: str,
        pr_body: str,
        base: str = "main",
    ) -> str:
        """Create a branch, commit files, open a PR. Returns the PR URL."""
        repo = self._gh.get_repo(repo_name)

        try:
            base_ref = repo.get_git_ref(f"heads/{base}")
        except Exception:
            base = repo.default_branch
            base_ref = repo.get_git_ref(f"heads/{base}")

        # Branch (idempotent: reuse if it already exists)
        try:
            repo.get_git_ref(f"heads/{branch}")
        except Exception:
            repo.create_git_ref(
                ref=f"refs/heads/{branch}", sha=base_ref.object.sha
            )

        # Build a tree with all updated files
        base_commit = repo.get_git_commit(base_ref.object.sha)
        elements = []
        from github import InputGitTreeElement

        for f in files:
            blob = repo.create_git_blob(f.content, "utf-8")
            elements.append(
                InputGitTreeElement(
                    path=f.path.lstrip("/"), mode="100644",
                    type="blob", sha=blob.sha,
                )
            )
        tree = repo.create_git_tree(elements, base_tree=base_commit.tree)
        commit = repo.create_git_commit(
            commit_message, tree, [base_commit]
        )
        ref = repo.get_git_ref(f"heads/{branch}")
        ref.edit(sha=commit.sha)

        pr = repo.create_pull(
            title=pr_title, body=pr_body, head=branch, base=base
        )
        return pr.html_url

    def list_repos(self) -> list[str]:
        return [r.full_name for r in self._gh.get_user().get_repos()[:50]]

    def read_file(self, repo_name: str, path: str, ref: str = "main") -> str:
        repo = self._gh.get_repo(repo_name)
        content = repo.get_contents(path, ref=ref)
        if isinstance(content, list):
            raise ValueError(f"{path} is a directory")
        return content.decoded_content.decode("utf-8", "replace")
