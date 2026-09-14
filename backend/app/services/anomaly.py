from dataclasses import dataclass, field
from datetime import datetime, timezone

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

from app.services.validation import is_soft_violation

FEATURES = ["temperature", "turbidity", "tds"]


@dataclass
class _DeviceModel:
    """Modelo de anomalia (Isolation Forest) de um unico dispositivo."""

    model: IsolationForest | None = None
    scaler: StandardScaler | None = None
    baseline: np.ndarray | None = None  # linhas [medianas, escalas MAD*1.4826] por feature
    since_last_train: int = 0


class AnomalyDetector:
    """Detecta anomalias em leituras usando Isolation Forest POR dispositivo.

    Cada dispositivo tem seu proprio modelo, treinado apenas com o proprio
    historico (um rio tem um 'normal' diferente do outro). Enquanto ha poucos
    dados, usa apenas os limites fisicos (soft bounds).

    Alem do Isolation Forest (deteccao de pontos isolados), aplica um z-score
    robusto (mediana/MAD) contra o historico: o Isolation Forest satura para
    valores muito alem do range de treino e sozinho nao marcaria um pico de
    contaminacao extremo.
    """

    def __init__(self, retrain_every: int = 100, min_samples: int = 20, z_threshold: float = 5.0) -> None:
        self.retrain_every = retrain_every
        self.min_samples = min_samples
        self.z_threshold = z_threshold
        self._models: dict[str, _DeviceModel] = {}

    def _history(self, db, device_id: str, n: int = 1000):
        from app.models.reading import Reading

        return (
            db.query(Reading)
            .filter(Reading.device_id == device_id)
            .order_by(Reading.timestamp.desc())
            .limit(n)
            .all()
        )

    def _fit(self, device_model: _DeviceModel, history) -> None:
        rows = [
            [r.temperature, r.turbidity, r.tds]
            for r in history
            if np.isfinite(r.temperature) and np.isfinite(r.turbidity) and np.isfinite(r.tds)
        ]
        if len(rows) < self.min_samples:
            device_model.model = None
            device_model.scaler = None
            device_model.baseline = None
            return
        rows_arr = np.asarray(rows, dtype=float)
        medians = np.median(rows_arr, axis=0)
        mad = np.median(np.abs(rows_arr - medians), axis=0)
        # Evita escala microscopica quando MAD=0 (historico constante) -> falso positivo
        raw_scale = 1.4826 * mad
        # floor ~5% da mediana ou 0.5 para turbidez/tds, 0.2 para temperatura
        floor = np.maximum(np.abs(medians) * 0.05 + 0.1, 0.1)
        scale = np.maximum(raw_scale, floor)
        # garante minimo absoluto 1e-6 para evitar divisao por zero
        scale = np.maximum(scale, 1e-6)
        device_model.baseline = np.stack([medians, scale])
        device_model.scaler = StandardScaler()
        x = device_model.scaler.fit_transform(rows_arr)
        device_model.model = IsolationForest(
            contamination=0.05, random_state=42, n_estimators=100
        )
        device_model.model.fit(x)
        device_model.since_last_train = 0

    def _check(self, device_model: _DeviceModel, temperature: float, turbidity: float, tds: float) -> bool:
        soft = is_soft_violation(temperature, turbidity, tds)
        if soft:
            return True
        point = np.asarray([[temperature, turbidity, tds]], dtype=float)
        if device_model.baseline is not None:
            z = float(np.max(np.abs(point - device_model.baseline[0]) / device_model.baseline[1]))
            if z > self.z_threshold:
                return True
        if device_model.model is None or device_model.scaler is None:
            return False
        scaled = device_model.scaler.transform(point)
        pred = int(device_model.model.predict(scaled)[0])
        return pred == -1

    def check(self, db, device_id: str, temperature: float, turbidity: float, tds: float) -> bool:
        """Avalia uma leitura sem re-treinar o modelo (uso pontual, ex.: /api/predict)."""
        device_model = self._models.get(device_id)
        if device_model is None:
            return is_soft_violation(temperature, turbidity, tds)
        return self._check(device_model, temperature, turbidity, tds)

    def on_new_reading(self, db, device_id: str, temperature: float, turbidity: float, tds: float) -> bool:
        device_model = self._models.get(device_id)
        if device_model is None:
            device_model = _DeviceModel()
            self._models[device_id] = device_model
        device_model.since_last_train += 1
        if device_model.model is None or device_model.since_last_train >= self.retrain_every:
            history = self._history(db, device_id)
            self._fit(device_model, history)
        return self._check(device_model, temperature, turbidity, tds)


def _get_anomaly_detector() -> AnomalyDetector:
    from app.config import settings as _settings
    return AnomalyDetector(retrain_every=_settings.anomaly_retrain_every)

# Instancia lazy com valor de settings; recriada se settings mudar em testes
try:
    from app.config import settings as _cfg
    anomaly_detector = AnomalyDetector(retrain_every=_cfg.anomaly_retrain_every)
except Exception:
    anomaly_detector = AnomalyDetector()
