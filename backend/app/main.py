import asyncio
import time as _time
from collections import defaultdict
from contextlib import asynccontextmanager
import logging
import math
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import aquarismo, chat, devices, health, ml, predict, readings, ws
from app.config import settings
from app.database.db import Base, SessionLocal, engine
from app.services.demo_simulator import demo_simulator
from app.services.ml_service import ml_service
from app.services.seed import seed_demo_if_empty

# Logs no console (Render captura stdout). Nivel via LOG_LEVEL; data completa
# para debug fora do Render (antes: so %H:%M:%S, sem data).
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
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
    # Bancos criados antes do indice composto: garante sem Alembic (idempotente).
    try:
        from sqlalchemy import text as _text

        with engine.begin() as _conn:
            _conn.execute(
                _text(
                    "CREATE INDEX IF NOT EXISTS ix_readings_device_timestamp "
                    "ON readings (device_id, timestamp)"
                )
            )
    except Exception:
        logging.getLogger("aquasense.db").warning(
            "Nao foi possivel garantir ix_readings_device_timestamp", exc_info=True
        )
    with SessionLocal() as db:
        seed_demo_if_empty(db)
    ml_service.load()

    simulator_task: asyncio.Task | None = None
    if demo_simulator.enabled:
        simulator_task = asyncio.create_task(demo_simulator.run())
        demo_simulator.set_task(simulator_task)

    yield

    if simulator_task:
        simulator_task.cancel()
        try:
            await simulator_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="AquaSense AI API",
    description="Monitoramento da qualidade da agua - backend do AquaSense AI",
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

# Comprime JSON/CSV grandes (history/export) — ganho gratis no Render free.
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Rate limit simples em memória para POST /api/readings e /api/chat
# Cap de IPs rastreados (evita crescimento ilimitado do dict — DoS de memoria).
_MAX_TRACKED_IPS = 2000
_rate_store: dict[str, list[float]] = defaultdict(list)
_chat_rate_store: dict[str, list[float]] = defaultdict(list)
_aquarismo_rate_store: dict[str, list[float]] = defaultdict(list)
_predict_rate_store: dict[str, list[float]] = defaultdict(list)
_export_rate_store: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 60  # requisições /api/readings
_RATE_WINDOW = 60  # segundos
_CHAT_RATE_LIMIT = settings.chat_rate_limit  # /api/chat (configurável via .env)
_AQUARISMO_RATE_LIMIT = 30  # /api/aquarismo/recomendar
_PREDICT_RATE_LIMIT = 30  # /api/predict (inferencia sem auth)
_EXPORT_RATE_LIMIT = 30  # /api/readings/export (CSV pesado)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # /api/readings e /api/chat com limites separados
    target_store = None
    limit = None
    if request.url.path == "/api/readings" and request.method == "POST":
        target_store, limit = _rate_store, _RATE_LIMIT
    elif request.url.path == "/api/chat" and request.method == "POST":
        target_store, limit = _chat_rate_store, _CHAT_RATE_LIMIT
    elif request.url.path == "/api/aquarismo/recomendar" and request.method == "POST":
        target_store, limit = _aquarismo_rate_store, _AQUARISMO_RATE_LIMIT
    elif request.url.path == "/api/predict" and request.method == "POST":
        target_store, limit = _predict_rate_store, _PREDICT_RATE_LIMIT
    elif request.url.path == "/api/readings/export" and request.method == "GET":
        target_store, limit = _export_rate_store, _EXPORT_RATE_LIMIT
    if target_store is not None:
        ip = request.client.host if request.client else "unknown"
        now = _time.monotonic()
        window_start = now - _RATE_WINDOW
        target_store[ip] = [t for t in target_store[ip] if t > window_start]
        # Eviccao: se muitos IPs distintos, descarta o mais antigo (cap DoS)
        if ip not in target_store and len(target_store) >= _MAX_TRACKED_IPS:
            oldest = next(iter(target_store))
            target_store.pop(oldest, None)
        if len(target_store[ip]) >= limit:
            resp = JSONResponse(status_code=429, content={"detail": "Muitas requisicoes. Tente novamente em segundos."})
            resp.headers["X-Content-Type-Options"] = "nosniff"
            resp.headers["X-Frame-Options"] = "DENY"
            resp.headers["Retry-After"] = str(_RATE_WINDOW)
            return resp
        target_store[ip].append(now)
    return await call_next(request)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


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
app.include_router(chat.router)
app.include_router(aquarismo.router)
app.include_router(ws.router)

# Dashboard (build do frontend) servido na mesma origem do backend:
# uma unica URL para o site, a API e o WebSocket.
# Montagem em "/" com html=True deve vir APOS os routers /api e /ws para nao sombrear 404 JSON.
if (FRONTEND_DIST / "index.html").exists():
    app.mount(
        "/",
        StaticFiles(directory=FRONTEND_DIST, html=True),
        name="dashboard",
    )