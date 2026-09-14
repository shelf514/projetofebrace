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
    # Protecao contra path traversal: resolve e verifica se esta dentro de datasets_dir
    try:
        base = settings.datasets_dir.resolve()
        dataset_path = (settings.datasets_dir / payload.dataset).resolve()
        if not dataset_path.is_relative_to(base):
            raise HTTPException(status_code=400, detail="Dataset invalido")
        # Apenas extensoes permitidas
        if dataset_path.suffix.lower() not in {".csv", ".xlsx", ".json"}:
            raise HTTPException(status_code=400, detail="Extensao de dataset nao suportada")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Dataset invalido")
    if not dataset_path.exists() or not dataset_path.is_file():
        raise HTTPException(status_code=404, detail="Dataset nao encontrado em ml/datasets/")
    try:
        from ml import train as train_module

        result = train_module.run(
            dataset_path=str(dataset_path),
            target=payload.target,
            test_size=payload.test_size,
        )
    except HTTPException:
        raise
    except Exception as exc:
        # Nao vazar detalhes internos (path, traceback) ao cliente
        raise HTTPException(status_code=400, detail="Falha no treinamento. Verifique o dataset e tente novamente.") from exc
    ml_service.load()
    return result
