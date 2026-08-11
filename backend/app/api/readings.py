from datetime import datetime, timedelta, timezone
import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import verify_api_key
from app.api.ws import manager
from app.database.db import get_db
from app.models import Device, Reading
from app.schemas.reading import ReadingCreate, ReadingOut, to_utc
from app.services.anomaly import anomaly_detector
from app.services.ml_service import ml_service
from app.services.validation import is_hard_violation

router = APIRouter(prefix="/api/readings", tags=["readings"])


def get_or_create_device(db: Session, device_id: str) -> Device:
    device = db.get(Device, device_id)
    if device is None:
        device = Device(id=device_id, name=device_id, status="unknown")
        db.add(device)
        db.flush()
    return device


@router.post("", response_model=ReadingOut, status_code=201, dependencies=[Depends(verify_api_key)])
async def create_reading(payload: ReadingCreate, db: Session = Depends(get_db)) -> Reading:
    if is_hard_violation(payload.temperature, payload.turbidity, payload.tds):
        raise HTTPException(
            status_code=422,
            detail="Valores fisicamente absurdos: fora dos limites aceitaveis.",
        )

    timestamp = payload.timestamp if payload.timestamp is not None else datetime.now(timezone.utc)
    timestamp = to_utc(timestamp)

    device = get_or_create_device(db, payload.device_id)
    device.last_seen = timestamp
    device.status = "online"

    prediction, probability = ml_service.predict(payload.temperature, payload.turbidity, payload.tds)
    anomaly = anomaly_detector.on_new_reading(
        db, payload.device_id, payload.temperature, payload.turbidity, payload.tds
    )

    reading = Reading(
        device_id=device.id,
        timestamp=timestamp,
        temperature=payload.temperature,
        turbidity=payload.turbidity,
        tds=payload.tds,
        prediction=prediction,
        prediction_probability=probability,
        anomaly=anomaly,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    await manager.broadcast(
        {
            "type": "reading",
            "data": ReadingOut.model_validate(reading).model_dump(mode="json"),
        }
    )
    return reading


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
