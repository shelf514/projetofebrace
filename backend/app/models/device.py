from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String

from app.database.db import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    api_key = Column(String(128), nullable=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(16), nullable=False, default="unknown")
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
