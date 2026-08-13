"""Gera dados MOCK/DEMO para testar o dashboard antes do hardware existir.

Uso: python scripts/seed_demo.py

Cria o dispositivo AQUASENSE-DEMO e ~30 dias de leituras sinteticas (MOCK).
Nunca apresente estes dados como cientificos.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database.db import Base, SessionLocal, engine  # noqa: E402
from app.services.seed import DEVICE_ID, seed_demo  # noqa: E402


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        count = seed_demo(db)
        print(f"Seed MOCK concluido: {count} leituras para {DEVICE_ID}")
        print("ATENCAO: dados sinteticos gerados apenas para testes do dashboard.")
    finally:
        db.close()


if __name__ == "__main__":
    main()