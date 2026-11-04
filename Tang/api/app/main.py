from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.repo import RepoUnavailable
from app.routes.counts import router as counts_router
from app.routes.stats import router as stats_router

app = FastAPI(title="SPDS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(counts_router)
app.include_router(stats_router)


@app.exception_handler(RepoUnavailable)
def repo_unavailable(request: Request, exc: RepoUnavailable):
    return JSONResponse(status_code=503, content={"detail": str(exc)})


@app.get("/health")
def health():
    return {"status": "ok"}
