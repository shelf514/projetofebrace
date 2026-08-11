import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("aquasense.ws")


class ConnectionManager:
    """Gerencia as conexoes WebSocket ativas e transmite novas leituras."""

    def __init__(self) -> None:
        self._active: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    @property
    def client_count(self) -> int:
        return len(self._active)

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._active.add(websocket)
        logger.info("Cliente WebSocket conectado (total=%d)", len(self._active))

    def disconnect(self, websocket: WebSocket) -> None:
        self._active.discard(websocket)
        logger.info("Cliente WebSocket desconectado (total=%d)", len(self._active))

    async def broadcast(self, message: dict) -> None:
        """Envia a mensagem para todos os clientes, removendo os que falharem."""
        dead: list[WebSocket] = []
        for websocket in list(self._active):
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
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        logger.exception("Erro na conexao WebSocket")
        manager.disconnect(websocket)
