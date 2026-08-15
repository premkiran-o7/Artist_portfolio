import os
import sys

sys.path.insert(0, os.path.dirname(__file__))  # make _lib importable on Vercel

from fastapi import FastAPI

app = FastAPI(title="Manish Portfolio API", docs_url=None, redoc_url=None)


@app.get("/api/py/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
