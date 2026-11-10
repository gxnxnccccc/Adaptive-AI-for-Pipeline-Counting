import math
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi import HTTPException

from app.config import settings
from app.repo import RepoUnavailable, storage_mode
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


@app.exception_handler(RequestValidationError)
def validation_error(request: Request, exc: RequestValidationError):
    """Same 422 as FastAPI's default, but a NaN/Infinity in the body (echoed back as `input`)
    is sent as a string: the default handler cannot JSON-encode it and fails with a 500."""
    finite = {float: lambda f: f if math.isfinite(f) else str(f)}
    return JSONResponse(status_code=422, content={"detail": jsonable_encoder(exc.errors(), custom_encoder=finite)})


@app.get("/health")
def health():
    return {"status": "ok", "storage": storage_mode()}


# Bundle mode: if demo/site/ (the built web app) exists, this API serves it too, so one process = the whole app.
SITE = Path(os.environ.get("SPDS_SITE") or Path(__file__).resolve().parents[2] / "demo" / "site")
if (SITE / "index.html").is_file():

    @app.get("/{path:path}", include_in_schema=False)
    def site(path: str):
        if path.startswith("api/"):
            raise HTTPException(status_code=404)
        f = (SITE / path).resolve()
        if path and f.is_file() and SITE.resolve() in f.parents:
            return FileResponse(f)
        return FileResponse(SITE / "index.html")  # client-side routes (/processing, /result, ...)
