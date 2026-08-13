from datetime import datetime, timedelta, timezone
import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import verify_api_key
from app.database.db import get_db
from app.models import Reading
from app.schemas.reading import ReadingCreate, ReadingOut, to_utc
from app.services.reading_service import create_and_broadcast

router = APIRouter(prefix="/api/readings", tags=["readings"])


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
    db: Session = Depends(get_db),
) -> Response:
    """Exporta as leituras do periodo em CSV (para treinar o modelo e relatorios)."""
    query = db.query(Reading)
    if start:
        query = query.filter(Reading.timestamp >= to_utc(start))
    if end:
        query = query.filter(Reading.timestamp <= to_utc(end))
    if device_id:
        query = query.filter(Reading.device_id == device_id)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["timestamp", "device_id", "temperature", "turbidity", "tds",
         "prediction", "prediction_probability", "anomaly"]
    )
    for reading in query.order_by(Reading.timestamp.asc()).yield_per(500):
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

    return Response(
        content=buffer.getvalue(),
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
    since = start or (datetime.now(timezone.utc) - timedelta(days=7))
    until = end or datetime.now(timezone.utc)
    query = db.query(Reading).filter(Reading.timestamp >= since, Reading.timestamp <= until)
    if device_id:
        query = query.filter(Reading.device_id == device_id)
    readings = query.all()
    if not readings:
        return {"count": 0}
    values = {
        "temperature": [r.temperature for r in readings],
        "turbidity": [r.turbidity for r in readings],
        "tds": [r.tds for r in readings],
    }
    stats = {"count": len(readings), "anomaly_count": sum(1 for r in readings if r.anomaly)}
    for name, series in values.items():
        stats[name] = {
            "min": min(series),
            "max": max(series),
            "avg": sum(series) / len(series),
        }
    return stats
