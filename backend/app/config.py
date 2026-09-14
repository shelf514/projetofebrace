import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    def __init__(self) -> None:
        raw_db = os.getenv("DATABASE_URL")
        if raw_db:
            self.database_url: str = raw_db
        else:
            # as_posix() evita backslashes no Windows (sqlite:///D:\...)
            self.database_url = f"sqlite:///{(BASE_DIR / 'aquasense.db').as_posix()}"
        self.api_key: str = os.getenv("API_KEY", "change-me")
        self.model_path: Path = Path(os.getenv("MODEL_PATH", str(BASE_DIR / "ml" / "outputs" / "model.pkl")))
        self.scaler_path: Path = Path(os.getenv("SCALER_PATH", str(BASE_DIR / "ml" / "outputs" / "scaler.pkl")))
        self.metadata_path: Path = Path(
            os.getenv("MODEL_METADATA_PATH", str(BASE_DIR / "ml" / "outputs" / "metadata.json"))
        )
        self.datasets_dir: Path = Path(os.getenv("DATASETS_DIR", str(BASE_DIR / "ml" / "datasets")))
        try:
            self.anomaly_retrain_every: int = int(os.getenv("ANOMALY_RETRAIN_EVERY", "100"))
        except ValueError:
            import logging as _logging
            _logging.getLogger("aquasense.config").warning(
                "ANOMALY_RETRAIN_EVERY invalido (%r), usando 100", os.getenv("ANOMALY_RETRAIN_EVERY")
            )
            self.anomaly_retrain_every = 100
        self.cors_origins: list[str] = [
            o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
        ]
        # LLM opcional (chat aquarismo) — usa OPENAI_API_KEY se presente, senão regras locais
        self.llm_api_key: str | None = os.getenv("OPENAI_API_KEY") or None
        self.llm_model: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
        self.llm_base_url: str = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
        self.chat_rate_limit: int = int(os.getenv("CHAT_RATE_LIMIT", "20"))
        # Aviso se API_KEY ainda e o placeholder em producao
        if self.api_key == "change-me" and (os.getenv("RENDER") or os.getenv("ENV") == "production"):
            import logging as _logging2
            _logging2.getLogger("aquasense.config").warning(
                "API_KEY ainda e 'change-me' em ambiente de producao! Defina uma chave forte."
            )


settings = Settings()
