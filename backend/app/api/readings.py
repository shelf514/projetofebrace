from datetime import datetime, timedelta, timezone
import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import Integer, func
from sqlalchemy.orm import Session

from app.api.deps import verify_api_key
from app.database.db import get_db
from app.models import Reading
from app.schemas.reading import ReadingCreate, ReadingOut, to_utc
from app.services.reading_service import create_and_broadcast

# Janela maxima aceita quando start+end sao informados (evita varredura total/OOM).
MAX_STATS_WINDOW_DAYS = 31
MAX_HISTORY_WINDOW_DAYS = 90

router = APIRouter(prefix="/api/readings", tags=["readings"])


def _check_window(start: datetime | None, end: datetime | None, max_days: int, label: str) -> None:
    if start and end:
        delta = (to_utc(end) - to_utc(start)).total_seconds()
        if delta < 0:
            raise HTTPException(status_code=422, detail=f"{label}: start apos end")
        if delta > max_days * 86400:
            raise HTTPException(
                status_code=422,
                detail=f"{label}: periodo maximo de {max_days} dias (use export paginado)",
            )


@router.post("", response_model=ReadingOut, status_code=201, dependencies=[Depends(verify_api_key)])
async def create_reading(payload: ReadingCreate, db: Session = Depends(get_db)) -> Reading:
    return await create_and_broadcast(
        db,
        payload.device_id,
        payload.temperature,
        payload.turbidity,
        payload.tds,
        payload.timestamp,
    )


@router.get("", response_model=list[ReadingOut])
def list_readings(
    device_id: str | None = None,
    anomaly: bool | None = None,
    prediction: str | None = None,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[Reading]:
    query = db.query(Reading)
    if device_id:
        query = query.filter(Reading.device_id == device_id)
    if anomaly is not None:
        query = query.filter(Reading.anomaly == anomaly)
    if prediction:
        query = query.filter(Reading.prediction == prediction)
    return (
        query.order_by(Reading.timestamp.desc()).offset(offset).limit(limit).all()
    )


@router.get("/latest", response_model=ReadingOut)
def latest_reading(device_id: str | None = None, db: Session = Depends(get_db)) -> Reading:
    query = db.query(Reading)
    if device_id:
        query = query.filter(Reading.device_id == device_id)
    reading = query.order_by(Reading.timestamp.desc()).first()
    if reading is None:
        raise HTTPException(status_code=404, detail="Nenhuma leitura encontrada")
    return reading


@router.get("/history", response_model=list[ReadingOut])
def reading_history(
    start: datetime | None = None,
    end: datetime | None = None,
    device_id: str | None = None,
    limit: int = Query(default=2000, ge=1, le=10000),
    db: Session = Depends(get_db),
) -> list[Reading]:
    _check_window(start, end, MAX_HISTORY_WINDOW_DAYS, "history")
    query = db.query(Reading)
    if start:
        query = query.filter(Reading.timestamp >= to_utc(start))
    if end:
        query = query.filter(Reading.timestamp <= to_utc(end))
    if device_id:
        query = query.filter(Reading.device_id == device_id)
    return query.order_by(Reading.timestamp.asc()).limit(limit).all()


@router.get("/export")
def export_readings_csv(
    start: datetime | None = None,
    end: datetime | None = None,
    device_id: str | None = None,
    limit: int = Query(default=10000, ge=1, le=50000),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Exporta as leituras do periodo em CSV (para treinar o modelo e relatorios)."""
    _check_window(start, end, MAX_HISTORY_WINDOW_DAYS, "export")
    query = db.query(Reading)
    if start:
        query = query.filter(Reading.timestamp >= to_utc(start))
    if end:
        query = query.filter(Reading.timestamp <= to_utc(end))
    if device_id:
        query = query.filter(Reading.device_id == device_id)

    def generate():
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            ["timestamp", "device_id", "temperature", "turbidity", "tds",
             "prediction", "prediction_probability", "anomaly"]
        )
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)
        for reading in query.order_by(Reading.timestamp.asc()).limit(limit).yield_per(500):
            writer.writerow(
                [
                    reading.timestamp.isoformat(),
                    reading.device_id,
                    reading.temperature,
                    reading.turbidity,
                    reading.tds,
                    reading.prediction or "",
                    "" if reading.prediction_probability is None else reading.prediction_probability,
                    "1" if reading.anomaly else "0",
                ]
            )
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    return StreamingResponse(
        generate(),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="aquasense_readings.csv"'
        },
    )


@router.get("/stats")
def reading_stats(
    start: datetime | None = None,
    end: datetime | None = None,
    device_id: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    _check_window(start, end, MAX_STATS_WINDOW_DAYS, "stats")
    since = to_utc(start) if start else (datetime.now(timezone.utc) - timedelta(days=7))
    until = to_utc(end) if end else datetime.now(timezone.utc)
    # Agregacao no banco (evita query.all() + OOM em periodos grandes)
    filters = [Reading.timestamp >= since, Reading.timestamp <= until]
    if device_id:
        filters.append(Reading.device_id == device_id)
    row = (
        db.query(
            func.count(Reading.id),
            func.sum(func.cast(Reading.anomaly, Integer)),
            func.min(Reading.temperature),
            func.max(Reading.temperature),
            func.avg(Reading.temperature),
            func.min(Reading.turbidity),
            func.max(Reading.turbidity),
            func.avg(Reading.turbidity),
            func.min(Reading.tds),
            func.max(Reading.tds),
            func.avg(Reading.tds),
        )
        .filter(*filters)
        .one()
    )
    count = int(row[0] or 0)
    if count == 0:
        return {"count": 0}
    return {
        "count": count,
        "anomaly_count": int(row[1] or 0),
        "temperature": {"min": row[2], "max": row[3], "avg": float(row[4]) if row[4] is not None else None},
        "turbidity": {"min": row[5], "max": row[6], "avg": float(row[7]) if row[7] is not None else None},
        "tds": {"min": row[8], "max": row[9], "avg": float(row[10]) if row[10] is not None else None},
    }
