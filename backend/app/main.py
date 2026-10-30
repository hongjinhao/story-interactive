from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import db, errors
from app.handlers import health, nodes, stories


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Story Interactive", lifespan=lifespan)

# The Vite dev server proxies /api to this app, so CORS is not needed in dev.
# It's here so the frontend still works if it is opened without the proxy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Every domain error carries its own status code (404, 409, 400, 502, 504).
@app.exception_handler(errors.AppError)
async def app_error(request: Request, exc: errors.AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


app.include_router(health.router)
app.include_router(stories.router)
app.include_router(nodes.router)
