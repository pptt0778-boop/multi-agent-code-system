# Multi-Agent Code System

Autonomous dual-agent AI software-engineering platform: a **Coder** agent and a
**Judge** agent iterate in configurable review cycles, execute code in an
isolated **Docker sandbox**, and push verified results to **GitHub**.

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 14 · TS · Tailwind · Framer · Monaco)     │
│  ┌───────────┬────────────────────────┬────────────────────┐ │
│  │ Sidebar   │ Chat (Coder⇄Judge)     │ Workspace          │ │
│  │ · API keys│ · (+) skills/search/   │ · Monaco editor    │ │
│  │ · models  │   review cycles        │ · Sandbox terminal │ │
│  │ · skills  │ · agent-tagged feed    │ · Preview canvas   │ │
│  │ · system  │ · live status bar      │ · Git / PR actions │ │
│  └───────────┴────────────────────────┴────────────────────┘ │
└──────────────────────────────┬───────────────────────────────┘
                            SSE │ POST /api/tasks → GET …/stream
┌──────────────────────────────┴───────────────────────────────┐
│  Backend (FastAPI · LiteLLM · PyGithub · docker-py)          │
│  Orchestrator: Coder → Sandbox → Judge → feedback loop (N≤10)│
│  · Key vault (Fernet-encrypted)  · Multi-provider fallback   │
│  · Context safeguard @75% (snapshot + CONTINUE_SESSION)      │
│  · Sandbox: 512MB, no network, non-root, read-only rootfs    │
└──────────────────────────────────────────────────────────────┘
```

## Quick start

### Frontend
```powershell
cd frontend
npm install
npm run dev          # http://localhost:3000
```

### Backend (requires Python 3.11+)
```powershell
cd backend
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # fill in keys
uvicorn app.main:app --reload --port 8000
```

> **Note:** Docker Desktop is required for the isolated sandbox. Without it,
> the backend automatically falls back to a local subprocess executor so you
> can still develop and test the orchestration loop.

## Deployment (GitHub Pages)

The frontend is configured for static export (`frontend/next.config.mjs`:
`output: 'export'`, `basePath: /multi-agent-code-system`). GitHub Pages is
enabled on this repo (`build_type: workflow`).

**To activate automatic deploys**, add the workflow at `.github/workflows/deploy.yml`
(copy below or keep it in the repo) with a token that has the `workflow` scope —
pushing workflow files via git/API requires that scope:

```yaml
name: Deploy frontend to GitHub Pages
on: { push: { branches: [main] }, workflow_dispatch: }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
      - run: npm run build
        env: { NODE_ENV: production }
      - uses: actions/upload-pages-artifact@v3
        with: { path: frontend/out }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Then in **Settings → Pages** set *Source* to **GitHub Actions** and push the workflow.

## Phase map (from the master prompt)

| Phase | Where |
|---|---|
| 1.1 API keys, fallback | `backend/app/services/vault.py`, `llm.py`; `frontend/components/sidebar/api-key-manager.tsx` |
| 1.2 / 5.1 Docker sandbox | `backend/app/services/sandbox.py` |
| 1.3 / 5.2 GitHub | `backend/app/services/github.py`; `frontend/components/workspace/git-tab.tsx` |
| 2.1 Agents | `backend/app/agents/coder.py`, `judge.py` |
| 2.2 N-cycle loop | `backend/app/services/orchestrator.py` |
| 3 UI/UX | `frontend/app`, `frontend/components/**` |
| 4 Context safeguard | `backend/app/services/context_guard.py` |
| 6 Skills/tools | `backend/app/skills.py`; `frontend/components/chat/extension-menu.tsx` |

## Event protocol (SSE)

`TaskEvent` frames: `agent_message` (coder/judge/system), `file_update`,
`terminal` (stdout/stderr/system), `verdict` (JudgeVerdict), `status`
(idle/coding/reviewing/executing/passed/failed/context_limit), `done`, `error`.
