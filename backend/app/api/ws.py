import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings

logger = logging.getLogger("aquasense.ws")

# Teto de clientes simultaneos (evita exaustao de memoria via N conexoes).
MAX_WS_CLIENTS = 200


def _origin_allowed(origin: str | None) -> bool:
    # APK/curl nao enviam Origin — aceitar (autenticacao por rede/API key no POST).
    if not origin:
        return True
    if "*" in settings.cors_origins:
        return True
    return origin.rstrip("/") in [o.rstrip("/") for o in settings.cors_origins]


class ConnectionManager:
    """Gerencia as conexoes WebSocket ativas e transmite novas leituras."""

    def __init__(self) -> None:
        self._active: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    @property
    def client_count(self) -> int:
        return len(self._active)

    async def connect(self, websocket: WebSocket) -> bool:
        """Aceita a conexao se origem e capacidade permitirem. Retorna False se recusada."""
        origin = websocket.headers.get("origin")
        if not _origin_allowed(origin):
            await websocket.close(code=4403)
            logger.warning("WebSocket recusado: origem %r nao permitida", origin)
            return False
        async with self._lock:
            if len(self._active) >= MAX_WS_CLIENTS:
                await websocket.close(code=1013)
                logger.warning("WebSocket recusado: lotado (%d clientes)", len(self._active))
                return False
            await websocket.accept()
            self._active.add(websocket)
        logger.info("Cliente WebSocket conectado (total=%d)", len(self._active))
        return True

    def disconnect(self, websocket: WebSocket) -> None:
        self._active.discard(websocket)
        logger.info("Cliente WebSocket desconectado (total=%d)", len(self._active))

    async def broadcast(self, message: dict) -> None:
        """Envia a mensagem para todos os clientes, removendo os que falharem."""
        async with self._lock:
            active = list(self._active)
        dead: list[WebSocket] = []
        for websocket in active:
            try:
                await websocket.send_json(message)
            except Exception:
                dead.append(websocket)
        for websocket in dead:
            self.disconnect(websocket)


manager = ConnectionManager()

router = APIRouter(tags=["realtime"])


@router.websocket("/ws/readings")
async def ws_readings(websocket: WebSocket) -> None:
    """Stream em tempo real das leituras (usado pelo dashboard/APK)."""
    if not await manager.connect(websocket):
        return
    try:
        while True:
            # timeout evita slowloris: cliente idle sera desconectado e reconecta
            await asyncio.wait_for(websocket.receive(), timeout=60.0)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        manager.disconnect(websocket)
    except Exception:
        logger.exception("Erro na conexao WebSocket")
        manager.disconnect(websocket)
