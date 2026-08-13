from datetime import datetime, timezone

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
    device_id: str = Field(min_length=1, max_length=64)
    temperature: float = Field(allow_inf_nan=False)
    turbidity: float = Field(ge=0, allow_inf_nan=False)
    tds: float = Field(ge=0, allow_inf_nan=False)
    timestamp: datetime | None = None


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
