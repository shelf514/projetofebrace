from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String

from app.database.db import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(String(64), primary_key=True)
    name = Column(String(128), nullable=False)
    # NB: sem api_key por dispositivo — autenticacao e via API_KEY global (X-API-Key).
    # A coluna legada `api_key` pode existir em bancos antigos; o ORM a ignora.
    last_seen = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(16), nullable=False, default="unknown")
    created_at = Column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
