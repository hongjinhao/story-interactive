# Working agreement for AI tools in this repo

Stack: FastAPI (backend/, port 8000) + React/Vite JS (frontend/, port 5173, proxies /api to the backend).
Run: `./dev.sh`    Test: `./test.sh`

## Guardrails
1. Plan first. Before writing code, state the approach, the data shape, and the edge cases. Wait for approval.
2. Small steps. One endpoint or one component per change. Run it after every change.
3. Tests with the feature. Add a pytest test for each endpoint, including the unhappy paths (400/404/empty).
4. Stay in scope. Don't add libraries, rename files, or refactor code that wasn't asked about.
5. Show the diff and explain it. The human reads every change before accepting it.
6. When something fails, report the real error output first and diagnose it. Don't guess-fix.
7. Validate input at the API boundary. Return correct status codes. Never trust the client.
8. Keep it simple. In-memory storage is fine unless a database is requested.
