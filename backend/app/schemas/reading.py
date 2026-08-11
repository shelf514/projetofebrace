from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


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
