import time

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.services.ml_service import ml_service

router = APIRouter(prefix="/api/health", tags=["health"])

_started = time.time()


@router.get("")
def health(db: Session = Depends(get_db)) -> dict:
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    status = ml_service.status() or {}
    return {
        "status": "ok" if db_ok else "degraded",
        "database": "ok" if db_ok else "error",
        "model_loaded": ml_service.is_loaded,
        "model_version": status.get("version"),
        "model_trained_at": status.get("trained_at"),
        "uptime_seconds": int(time.time() - _started),
    }
