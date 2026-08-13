from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.reading import _utc_or_none


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    last_seen: datetime | None
    status: str
    created_at: datetime

    @field_validator("last_seen", "created_at", mode="before")
    @classmethod
    def _as_utc(cls, value):
        return _utc_or_none(value)
