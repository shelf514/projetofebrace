import json
import logging

import joblib
import numpy as np
import pandas as pd

from app.config import settings

logger = logging.getLogger("aquasense.ml")


class MLService:
    """Carrega e aplica o modelo de ML salvo em disco (model.pkl + metadata.json)."""

    def __init__(self) -> None:
        self.model = None
        self.scaler = None
        self.metadata: dict | None = None
        self.load()

    def load(self) -> None:
        try:
            if self.metadata_path.exists():
                with open(self.metadata_path, "r", encoding="utf-8") as fh:
                    self.metadata = json.load(fh)
            if self.model_path.exists():
                self.model = joblib.load(self.model_path)
            if self.scaler_path.exists():
                self.scaler = joblib.load(self.scaler_path)
            if self.model is None:
                logger.info("Nenhum modelo de ML carregado (model.pkl ausente).")
            else:
                logger.info("Modelo de ML carregado: %s", self.model.__class__.__name__)
        except Exception:
            logger.exception("Falha ao carregar o modelo de ML")
            self.model = None
            self.scaler = None
            self.metadata = None

    @property
    def model_path(self):
        return settings.model_path

    @property
    def scaler_path(self):
        return settings.scaler_path

    @property
    def metadata_path(self):
        return settings.metadata_path

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def predict(self, temperature: float, turbidity: float, tds: float):
        if self.model is None:
            return None, None
        features = [[float(temperature), float(turbidity), float(tds)]]
        if self.scaler is not None:
            features = self.scaler.transform(features)
        if hasattr(self.model, "feature_names_in_"):
            features = pd.DataFrame(features, columns=list(self.model.feature_names_in_))
        prediction = self.model.predict(features)[0]
        if hasattr(self.model, "predict_proba"):
            proba = self.model.predict_proba(features)[0]
            idx = int(proba.argmax())
            probability = float(proba[idx])
            labels = (self.metadata or {}).get("labels")
            if labels and isinstance(labels, list) and 0 <= idx < len(labels):
                prediction = labels[idx]
            else:
                prediction = str(prediction)
        else:
            prediction = str(prediction)
            probability = None
        return str(prediction), probability

    def status(self) -> dict | None:
        if self.metadata is None:
            return None
        return dict(self.metadata)


ml_service = MLService()
