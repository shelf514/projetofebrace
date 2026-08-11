import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database.db import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.config import settings  # noqa: E402

API_KEY = settings.api_key


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = testing_session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers():
    return {"X-API-Key": API_KEY}


@pytest.fixture()
def valid_payload():
    return {
        "device_id": "AQUASENSE-TEST",
        "temperature": 25.7,
        "turbidity": 12.4,
        "tds": 238.0,
        "timestamp": "2026-08-09T20:00:00Z",
    }
