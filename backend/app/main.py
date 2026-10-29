from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from app import db


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Fullstack Starter", lifespan=lifespan)

# The Vite dev server proxies /api to this app, so CORS is not needed in dev.
# It's here so the frontend still works if it is opened without the proxy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health(response: Response):
    if not db.ping():
        response.status_code = 503
        return {"status": "database unreachable", "db": db.kind()}
    return {"status": "ok", "db": db.kind()}
