"""Seed de dados DEMO (MOCK) para o banco.

Reutilizado por scripts/seed_demo.py e pelo startup do servidor (quando o
banco esta vazio - ex.: primeiro boot de instancia hospedada).

ATENCAO: dados sinteticos gerados apenas para testes do dashboard, nunca
apresentar como dados cientificos.
"""

import logging
from datetime import datetime, timedelta, timezone

import numpy as np
from sqlalchemy.orm import Session

from app.models import Device, Reading

logger = logging.getLogger("aquasense.seed")

DEVICE_ID = "AQUASENSE-DEMO"
DEVICE_NAME = "Dispositivo de demonstracao (MOCK)"
DAYS = 30
INTERVAL_MINUTES = 10


def build_readings() -> list[dict]:
    rng = np.random.default_rng(7)
    now = datetime.now(timezone.utc)
    readings = []
    for i in range(DAYS * 24 * (60 // INTERVAL_MINUTES)):
        ts = now - timedelta(minutes=i * INTERVAL_MINUTES)
        phase = i / (6 * 24 / 12)
        temperature = 25.0 + 2.2 * np.sin(phase / 6) + rng.normal(0, 0.4)
        turbidity = 14.0 + 5.0 * np.sin(phase / 4) + rng.normal(0, 2.5)
        tds = 265.0 + 35.0 * np.sin(phase / 2.5) + rng.normal(0, 18)
        if i in {45, 46, 47, 900, 901}:
            turbidity += rng.uniform(350, 700)
            tds += rng.uniform(800, 1500)
        readings.append(
            {
                "timestamp": ts,
                "temperature": round(float(temperature), 2),
                "turbidity": round(float(max(turbidity, 0)), 2),
                "tds": round(float(max(tds, 0)), 2),
            }
        )
    return readings


def seed_demo(db: Session) -> int:
    """Insere o dispositivo AQUASENSE-DEMO e ~30 dias de leituras MOCK.

    Retorna a quantidade de leituras inseridas. Se o dispositivo ja existe,
    apenas adiciona as leituras (idempotente por chamada).
    """
    device = db.get(Device, DEVICE_ID)
    if device is None:
        device = Device(id=DEVICE_ID, name=DEVICE_NAME, status="online")
        db.add(device)
        db.flush()
    readings = build_readings()
    for item in readings:
        db.add(
            Reading(
                device_id=device.id,
                timestamp=item["timestamp"],
                temperature=item["temperature"],
                turbidity=item["turbidity"],
                tds=item["tds"],
                prediction=None,
                prediction_probability=None,
                anomaly=item["turbidity"] > 300 or item["tds"] > 800,
            )
        )
    device.last_seen = readings[0]["timestamp"]
    db.commit()
    return len(readings)


def seed_demo_if_empty(db: Session) -> bool:
    """Aplica o seed apenas quando nao existe nenhum dispositivo no banco."""
    if db.query(Device).count() > 0:
        return False
    count = seed_demo(db)
    logger.info("Seed MOCK aplicado no startup: %d leituras para %s", count, DEVICE_ID)
    return True