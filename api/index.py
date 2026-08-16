import os
import sys

sys.path.insert(0, os.path.dirname(__file__))  # make _lib importable on Vercel

from fastapi import FastAPI

from _lib.auth import router as auth_router
from _lib.routes_clients import router as clients_router
from _lib.routes_photos import router as photos_router
from _lib.routes_uploads import router as uploads_router
from _lib.routes_videos import router as videos_router

app = FastAPI(title="Manish Portfolio API", docs_url=None, redoc_url=None)
app.include_router(auth_router)
app.include_router(videos_router)
app.include_router(clients_router)
app.include_router(photos_router)
app.include_router(uploads_router)


@app.get("/api/py/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
