import asyncio
from contextlib import asynccontextmanager
import logging
import math
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import devices, health, ml, predict, readings, ws
from app.config import settings
from app.database.db import Base, SessionLocal, engine
from app.services.demo_simulator import demo_simulator
from app.services.ml_service import ml_service
from app.services.seed import seed_demo_if_empty

# Logs INFO dos modulos do app (seed MOCK, simulador, ML) no console.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)

FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


def _finite(value):
    """Converte NaN/Inf para None para permitir a serializacao do erro."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {k: _finite(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_finite(v) for v in value]
    return value


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_if_empty(db)
    ml_service.load()

    simulator_task: asyncio.Task | None = None
    if demo_simulator.enabled:
        simulator_task = asyncio.create_task(demo_simulator.run())

    yield

    if simulator_task:
        simulator_task.cancel()
        try:
            await simulator_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="AquaSense AI API",
    description="Monitoramento da qualidade da agua - backend do AquaSense AI (FEBRACE)",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=_finite(jsonable_encoder(exc.errors())),
    )


app.include_router(health.router)
app.include_router(devices.router)
app.include_router(readings.router)
app.include_router(predict.router)
app.include_router(ml.router)
app.include_router(ws.router)

# Dashboard (build do frontend) servido na mesma origem do backend:
# uma unica URL para o site, a API e o WebSocket.
if (FRONTEND_DIST / "index.html").exists():
    app.mount(
        "/",
        StaticFiles(directory=FRONTEND_DIST, html=True),
        name="dashboard",
    )