from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DeviceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    last_seen: datetime | None
    status: str
    created_at: datetime
