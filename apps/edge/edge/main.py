import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routers import api_router

from .config import get_settings
from .notify import router as notify_router
from .webhook import router as webhook_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger("edge")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    if not settings.ngrok_domain:
        yield
        return

    import ngrok

    forwarder = await ngrok.forward(
        "localhost:8000",
        authtoken_from_env=True,
        domain=settings.ngrok_domain,
    )
    public_url = forwarder.url()
    logger.info("Webhook URL: %s/webhook", public_url)
    logger.info("API docs: %s/docs", public_url)

    yield

    disconnect = ngrok.disconnect()
    if hasattr(disconnect, "__await__"):
        await disconnect


app = FastAPI(
    title="edge",
    description=(
        "WhatsApp edge: Meta webhook, STT, outbound send, and /notify. "
        "Trigger routers under /docs still send via the Cloud API."
    ),
    lifespan=lifespan,
    openapi_tags=[
        {"name": "Messages", "description": "Send WhatsApp text messages."},
        {"name": "Orders", "description": "Dummy cart checkout and delivery address."},
        {"name": "Polls", "description": "Order confirmation Yes/No poll."},
        {"name": "Location", "description": "Share or request a location."},
        {"name": "Audio", "description": "Transcribe voice (English / Malayalam mix)."},
        {"name": "Addresses", "description": "Saved customer addresses."},
    ],
)
app.include_router(webhook_router)
app.include_router(notify_router)
app.include_router(api_router)


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "service": "edge"}
