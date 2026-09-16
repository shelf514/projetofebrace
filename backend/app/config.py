import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    def __init__(self) -> None:
        raw_db = os.getenv("DATABASE_URL")
        if raw_db:
            # Render/Heroku entregam postgres:// (deprecado no SQLAlchemy) — normaliza
            if raw_db.startswith("postgres://"):
                raw_db = "postgresql+psycopg://" + raw_db[len("postgres://"):]
            elif raw_db.startswith("postgresql://"):
                raw_db = "postgresql+psycopg://" + raw_db[len("postgresql://"):]
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
        try:
            self.chat_rate_limit: int = int(os.getenv("CHAT_RATE_LIMIT", "20"))
        except ValueError:
            import logging as _logging3
            _logging3.getLogger("aquasense.config").warning(
                "CHAT_RATE_LIMIT invalido (%r), usando 20", os.getenv("CHAT_RATE_LIMIT")
            )
            self.chat_rate_limit = 20
        if self.chat_rate_limit <= 0:
            import logging as _logging4
            _logging4.getLogger("aquasense.config").warning(
                "CHAT_RATE_LIMIT<=0 (%r), usando 20", self.chat_rate_limit
            )
            self.chat_rate_limit = 20
        if self.anomaly_retrain_every <= 0:
            import logging as _logging5
            _logging5.getLogger("aquasense.config").warning(
                "ANOMALY_RETRAIN_EVERY<=0 (%r), usando 100", self.anomaly_retrain_every
            )
            self.anomaly_retrain_every = 100
        # Fail-fast: placeholder em producao nao pode passar silencioso
        if self.api_key in ("", "change-me") and (os.getenv("RENDER") or os.getenv("ENV") == "production"):
            raise RuntimeError(
                "API_KEY ainda e placeholder em ambiente de producao! "
                "Defina uma chave forte (openssl rand -hex 32)."
            )
        # Aviso se API_KEY ainda e o placeholder em desenvolvimento
        if self.api_key == "change-me" and not (os.getenv("RENDER") or os.getenv("ENV") == "production"):
            import logging as _logging2
            _logging2.getLogger("aquasense.config").warning(
                "API_KEY ainda e 'change-me' (desenvolvimento). Troque antes da feira."
            )


settings = Settings()
