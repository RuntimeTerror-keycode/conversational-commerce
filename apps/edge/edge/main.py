import logging

from fastapi import FastAPI

from .webhook import router as webhook_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

app = FastAPI(title="edge")
app.include_router(webhook_router)


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "edge"}
