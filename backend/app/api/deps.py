from fastapi import Header, HTTPException

from app.config import settings


def verify_api_key(x_api_key: str = Header(default="", alias="X-API-Key")) -> None:
    """Exige a API key configurada em .env para endpoints de escrita/treino."""
    if not settings.api_key:
        return
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="API key invalida")
