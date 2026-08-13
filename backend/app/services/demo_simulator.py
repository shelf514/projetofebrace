"""Simulador de leituras ao vivo para demonstracao (dados MOCK).

Gera uma leitura nova periodica para o dispositivo AQUASENSE-DEMO usando a
mesma serie sintetica do seed, com picos de anomalia ocasionais. Os dados
passam pelo mesmo pipeline do POST real (predicao ML + deteccao de anomalia
+ broadcast WebSocket), entao o dashboard mostra tudo chegando em tempo real.

Controlado por env vars (todas opcionais):
  DEMO_SIMULATOR_ENABLED         "1" (padrao) para ligar, "0" para desligar
  DEMO_SIMULATOR_INTERVAL_SEC    intervalo entre leituras (padrao 40s)
  DEMO_SIMULATOR_DEVICE_ID       dispositivo usado (padrao AQUASENSE-DEMO)
  DEMO_SIMULATOR_ANOMALY_PROB    probabilidade de pico/anomalia por leitura
"""

import asyncio
import logging
import math
import os
from datetime import datetime, timezone

import numpy as np

from app.database.db import SessionLocal
from app.services.reading_service import create_and_broadcast

logger = logging.getLogger("aquasense.simulator")

DEFAULT_DEVICE_ID = "AQUASENSE-DEMO"
DEFAULT_INTERVAL_SEC = 40.0


class DemoSimulator:
    def __init__(self) -> None:
        self.enabled = os.getenv("DEMO_SIMULATOR_ENABLED", "1") != "0"
        self.interval = float(os.getenv("DEMO_SIMULATOR_INTERVAL_SEC", str(DEFAULT_INTERVAL_SEC)))
        self.device_id = os.getenv("DEMO_SIMULATOR_DEVICE_ID", DEFAULT_DEVICE_ID)
        self.anomaly_prob = float(os.getenv("DEMO_SIMULATOR_ANOMALY_PROB", "0.02"))
        self._rng = np.random.default_rng()

    def _values(self, now: datetime) -> tuple[float, float, float]:
        phase = now.timestamp() / 3600.0
        temperature = 25.0 + 2.2 * math.sin(phase / 6.0) + float(self._rng.normal(0, 0.4))
        turbidity = 14.0 + 5.0 * math.sin(phase / 4.0) + float(self._rng.normal(0, 2.5))
        tds = 265.0 + 35.0 * math.sin(phase / 2.5) + float(self._rng.normal(0, 18.0))
        if self._rng.random() < self.anomaly_prob:
            turbidity += float(self._rng.uniform(300, 700))
            tds += float(self._rng.uniform(500, 1200))
        return (
            round(max(temperature, 0.0), 2),
            round(max(turbidity, 0.0), 2),
            round(max(tds, 0.0), 2),
        )

    async def run(self) -> None:
        logger.info(
            "Simulador DEMO ao vivo iniciado (dispositivo=%s, intervalo=%.0fs)",
            self.device_id,
            self.interval,
        )
        while True:
            await asyncio.sleep(self.interval)
            temperature, turbidity, tds = self._values(datetime.now(timezone.utc))
            db = SessionLocal()
            try:
                await create_and_broadcast(
                    db,
                    self.device_id,
                    temperature=temperature,
                    turbidity=turbidity,
                    tds=tds,
                )
                logger.info(
                    "Leitura DEMO simulada: T=%.2f °C | NTU=%.2f | TDS=%.2f",
                    temperature,
                    turbidity,
                    tds,
                )
            except Exception:
                logger.exception("Falha ao gerar leitura DEMO simulada")
            finally:
                db.close()


demo_simulator = DemoSimulator()