from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager

from app.config import settings
from app.routers import (
    health, users, reports, incidents, cleanup, volunteers,
    attendance, ecoquest, passive, driver, maps, analytics, media, ws,
    departments, registration_invites, analyzer, passive_pipeline,
)
from app.services.redis_queue import ensure_consumer_groups

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        ensure_consumer_groups()
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Redis consumer groups not initialized: %s", exc)
    yield


app = FastAPI(
    title="CiVX API",
    version="1.0.0",
    description="Civic Visual X-Ray Platform",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(users.router)
app.include_router(registration_invites.router)
app.include_router(reports.router)
app.include_router(incidents.router)
app.include_router(departments.router)
app.include_router(cleanup.router)
app.include_router(volunteers.router)
app.include_router(attendance.router)
app.include_router(ecoquest.router)
app.include_router(passive.router)
app.include_router(passive_pipeline.router)
app.include_router(driver.router)
app.include_router(maps.router)
app.include_router(analytics.router)
app.include_router(media.router)
app.include_router(analyzer.router)
app.include_router(ws.router)
