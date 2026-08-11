from contextlib import asynccontextmanager
import math

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import devices, health, ml, predict, readings, ws
from app.config import settings
from app.database.db import Base, engine
from app.services.ml_service import ml_service


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
    ml_service.load()
    yield


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
