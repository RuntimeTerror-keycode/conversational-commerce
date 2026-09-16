from fastapi import APIRouter

from app.routers.addresses import router as addresses_router
from app.routers.audio import router as audio_router
from app.routers.location import router as location_router
from app.routers.orders import router as orders_router
from app.routers.polls import router as polls_router
from app.routers.products import router as products_router
from app.routers.text import router as text_router

api_router = APIRouter()

api_router.include_router(text_router)
api_router.include_router(orders_router)
api_router.include_router(addresses_router)
api_router.include_router(polls_router)
api_router.include_router(products_router)
api_router.include_router(location_router)
api_router.include_router(audio_router)

# Incoming Meta webhooks are owned by edge.webhook.
