import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    def __init__(self) -> None:
        self.database_url: str = os.getenv(
            "DATABASE_URL", f"sqlite:///{BASE_DIR / 'aquasense.db'}"
        )
        self.api_key: str = os.getenv("API_KEY", "change-me")
        self.model_path: Path = Path(os.getenv("MODEL_PATH", str(BASE_DIR / "ml" / "outputs" / "model.pkl")))
        self.scaler_path: Path = Path(os.getenv("SCALER_PATH", str(BASE_DIR / "ml" / "outputs" / "scaler.pkl")))
        self.metadata_path: Path = Path(
            os.getenv("MODEL_METADATA_PATH", str(BASE_DIR / "ml" / "outputs" / "metadata.json"))
        )
        self.datasets_dir: Path = Path(os.getenv("DATASETS_DIR", str(BASE_DIR / "ml" / "datasets")))
        self.anomaly_retrain_every: int = int(os.getenv("ANOMALY_RETRAIN_EVERY", "100"))
        self.cors_origins: list[str] = [
            o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()
        ]


settings = Settings()
