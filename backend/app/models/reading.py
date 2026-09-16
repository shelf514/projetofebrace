from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, String

from app.database.db import Base


class Reading(Base):
    __tablename__ = "readings"

    __table_args__ = (
        Index("ix_readings_device_timestamp", "device_id", "timestamp"),
    )

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(64), ForeignKey("devices.id"), index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), index=True, nullable=False)
    temperature = Column(Float, nullable=False)
    turbidity = Column(Float, nullable=False)
    tds = Column(Float, nullable=False)
    prediction = Column(String(64), nullable=True)
    prediction_probability = Column(Float, nullable=True)
    anomaly = Column(Boolean, nullable=False, default=False)
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
