# Fullstack starter (FastAPI + React/Vite)

Hello-world full-stack app for the Commure AI-assisted interview.

## First-time setup
```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ..
cd frontend && npm install && cd ..
```

## Run
```bash
./dev.sh          # backend http://127.0.0.1:8000  frontend http://localhost:5173
./test.sh         # backend tests
```

Open http://localhost:5173. It should say "Backend status: ok". If it says "backend unreachable", the backend isn't running.
Backend docs: http://127.0.0.1:8000/docs

## Pre-interview checklist
- [ ] `./dev.sh` runs and the page shows "Backend status: ok"
- [ ] `./test.sh` passes
- [ ] `node -v` is 20 or higher, `git` works, `gh auth status` is logged in
- [ ] Claude Code (or Cursor/Codex) is signed in and working in this folder
- [ ] Chrome and Google Meet: full-screen share works, filters off
