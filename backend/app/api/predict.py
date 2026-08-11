from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.db import get_db
from app.schemas.ml import PredictRequest, PredictResponse
from app.services.anomaly import anomaly_detector
from app.services.ml_service import ml_service
from app.services.validation import is_hard_violation

router = APIRouter(prefix="/api/predict", tags=["ml"])


@router.post("", response_model=PredictResponse)
def predict(payload: PredictRequest, db: Session = Depends(get_db)) -> PredictResponse:
    if is_hard_violation(payload.temperature, payload.turbidity, payload.tds):
        raise HTTPException(
            status_code=422,
            detail="Valores fisicamente absurdos: fora dos limites aceitaveis.",
        )
    if not ml_service.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="Modelo de ML nao treinado. Execute POST /api/ml/train primeiro.",
        )
    prediction, probability = ml_service.predict(
        payload.temperature, payload.turbidity, payload.tds
    )
    anomaly = anomaly_detector.check(
        db, payload.device_id, payload.temperature, payload.turbidity, payload.tds
    )
    return PredictResponse(
        prediction=prediction,
        prediction_probability=probability,
        anomaly=anomaly,
        model_loaded=True,
    )
