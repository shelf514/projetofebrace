"""Logica compartilhada de criacao de leituras.

Usada pelo endpoint POST /api/readings e pelo simulador DEMO ao vivo,
para que ambos passem pelo mesmo pipeline: validacao fisica, upsert do
dispositivo, predicao ML, deteccao de anomalia e broadcast WebSocket.
"""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api.ws import manager
from app.models import Device, Reading
from app.schemas.reading import ReadingOut, to_utc
from app.services.anomaly import anomaly_detector
from app.services.ml_service import ml_service
from app.services.validation import is_hard_violation


def get_or_create_device(db: Session, device_id: str) -> Device:
    device = db.get(Device, device_id)
    if device is None:
        device = Device(id=device_id, name=device_id, status="unknown")
        db.add(device)
        db.flush()
    return device


def process_reading(
    db: Session,
    device_id: str,
    temperature: float,
    turbidity: float,
    tds: float,
    timestamp: datetime | None = None,
) -> Reading:
    """Valida, prediz e persiste uma leitura (sem broadcast)."""
    if is_hard_violation(temperature, turbidity, tds):
        raise HTTPException(
            status_code=422,
            detail="Valores fisicamente absurdos: fora dos limites aceitaveis.",
        )

    ts = to_utc(timestamp) if timestamp is not None else datetime.now(timezone.utc)

    device = get_or_create_device(db, device_id)
    device.last_seen = ts
    device.status = "online"

    prediction, probability = ml_service.predict(temperature, turbidity, tds)
    anomaly = anomaly_detector.on_new_reading(
        db, device_id, temperature, turbidity, tds
    )

    reading = Reading(
        device_id=device.id,
        timestamp=ts,
        temperature=temperature,
        turbidity=turbidity,
        tds=tds,
        prediction=prediction,
        prediction_probability=probability,
        anomaly=anomaly,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    # Se hardware real (AQUASENSE-001) enviar, desliga o simulador automaticamente
    if device_id == "AQUASENSE-001":
        try:
            from app.services.demo_simulator import demo_simulator

            demo_simulator.stop_for_hardware(device_id)
        except Exception:
            pass  # nunca quebrar ingestão por causa do simulador
    return reading


async def create_and_broadcast(
    db: Session,
    device_id: str,
    temperature: float,
    turbidity: float,
    tds: float,
    timestamp: datetime | None = None,
) -> Reading:
    """process_reading + broadcast WebSocket para o dashboard."""
    reading = process_reading(db, device_id, temperature, turbidity, tds, timestamp)
    await manager.broadcast(
        {
            "type": "reading",
            "data": ReadingOut.model_validate(reading).model_dump(mode="json"),
        }
    )
    return reading
