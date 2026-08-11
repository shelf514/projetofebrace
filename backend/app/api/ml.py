from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import verify_api_key
from app.config import settings
from app.schemas.ml import TrainRequest
from app.services.ml_service import ml_service

router = APIRouter(prefix="/api/ml", tags=["ml"])


@router.get("/status")
def ml_status() -> dict:
    status = ml_service.status()
    if status is None:
        return {
            "model_loaded": False,
            "message": "Nenhum modelo treinado ainda.",
        }
    status["model_loaded"] = ml_service.is_loaded
    return status


@router.get("/datasets")
def list_datasets() -> dict:
    if not settings.datasets_dir.exists():
        return {"datasets": []}
    files = sorted(
        p.name
        for p in settings.datasets_dir.iterdir()
        if p.is_file() and p.suffix.lower() in {".csv", ".xlsx", ".json"}
    )
    return {"datasets": files}


@router.post("/train", dependencies=[Depends(verify_api_key)])
def train_model(payload: TrainRequest) -> dict:
    dataset_path = settings.datasets_dir / payload.dataset
    if not dataset_path.exists():
        raise HTTPException(status_code=404, detail="Dataset nao encontrado em ml/datasets/")
    try:
        from ml import train as train_module

        result = train_module.run(
            dataset_path=str(dataset_path),
            target=payload.target,
            test_size=payload.test_size,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Falha no treinamento: {exc}") from exc
    ml_service.load()
    return result
