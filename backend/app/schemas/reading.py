from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _utc_or_none(value):
    """Datetimes do SQLite saem 'naive' (UTC); anexa o fuso para o cliente
    nao interpretar como hora local (deslocamento de horas no dashboard)."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return value


class ReadingCreate(BaseModel):
    device_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    temperature: float = Field(allow_inf_nan=False)
    turbidity: float = Field(ge=0, allow_inf_nan=False)
    tds: float = Field(ge=0, allow_inf_nan=False)
    timestamp: datetime | None = None

    @field_validator("timestamp", mode="before")
    @classmethod
    def _validate_timestamp(cls, value):
        if value is None or value == "":
            return None
        if isinstance(value, str):
            try:
                dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                raise ValueError("timestamp invalido (use ISO 8601)")
            value = dt
        if isinstance(value, datetime):
            # Rejeita timestamps muito no futuro (>5 min) — evita dados falsos/injeção
            now = datetime.now(timezone.utc)
            dt_utc = to_utc(value)
            if dt_utc > now + timedelta(minutes=5):
                raise ValueError("timestamp no futuro (>5 min) não permitido")
            # Rejeita timestamps absurdamente antigos
            if dt_utc.year < 2000:
                raise ValueError("timestamp muito antigo")
        return value


class ReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_id: str
    timestamp: datetime
    temperature: float
    turbidity: float
    tds: float
    prediction: str | None
    prediction_probability: float | None
    anomaly: bool
    created_at: datetime

    @field_validator("timestamp", "created_at", mode="before")
    @classmethod
    def _as_utc(cls, value):
        return _utc_or_none(value)
