import asyncio
import uuid
import logging
from fastapi import WebSocket
from typing import Callable, Awaitable, Any,  Set

MessageHandler = Callable[[str, WebSocket, Any], Awaitable[None]]
InitialDataCallback = Callable[[WebSocket], Awaitable[Any]]

logger = logging.getLogger("websocket_manager")


class WebSocketManager:
    _instance: "WebSocketManager | None" = None

    connections: dict[str, WebSocket]
    metadata: dict[str, dict[str, Any]]
    channels: dict[str, Set[str]]
    message_handlers: dict[str, MessageHandler]
    initial_data_callbacks: list[tuple[str, InitialDataCallback | Any]]
    _lock: asyncio.Lock

    # atributo para habilitar/deshabilitar logs
    enable_logging: bool = False

    def __new__(cls) -> "WebSocketManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.connections = {}
            cls._instance.metadata = {}
            cls._instance.channels = {}
            cls._instance.message_handlers = {}
            cls._instance.initial_data_callbacks = []
            cls._instance._lock = asyncio.Lock()
        return cls._instance

    # -------------------------
    # Helper para logging condicional
    # -------------------------
    def _log(self, level: str, msg: str):
        if not self.enable_logging:
            return
        if level == "info":
            logger.info(msg)
        elif level == "warning":
            logger.warning(msg)
        elif level == "error":
            logger.error(msg)

    # -------------------------
    # Conexión
    # -------------------------
    async def connect(self, websocket: WebSocket, metadata: dict[str, Any] | None = None) -> str:
        await websocket.accept()
        connection_id = str(uuid.uuid4())

        async with self._lock:
            self.connections[connection_id] = websocket
            self.metadata[connection_id] = metadata or {}

        self._log("info", f"WebSocket conectado: {connection_id}")

        tasks = []
        for event_name, callback in self.initial_data_callbacks:
            if callable(callback):
                tasks.append(self._send_initial_data(connection_id, event_name, callback))
            else:
                tasks.append(
                    websocket.send_json({"event": event_name, "data": callback})
                )

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        return connection_id

    async def _send_initial_data(self, connection_id: str, event_name: str, callback: InitialDataCallback):
        ws = self.connections.get(connection_id)
        if not ws:
            return
        try:
            data = await callback(connection_id, ws)
            await ws.send_json({"event": event_name, "data": data})
        except Exception as e:
            self._log("error", f"Error enviando datos iniciales {event_name}: {e}")

    # -------------------------
    # Desconexión
    # -------------------------
    async def disconnect(self, connection_id: str):
        async with self._lock:
            ws = self.connections.pop(connection_id, None)
            self.metadata.pop(connection_id, None)

            if not ws:
                return

            for channel in list(self.channels.keys()):
                self.channels[channel].discard(connection_id)
                if not self.channels[channel]:
                    del self.channels[channel]

        self._log("info", f"WebSocket desconectado: {connection_id}")

    # -------------------------
    # Suscripción a canales
    # -------------------------
    async def subscribe(self, connection_id: str, channel: str):
        async with self._lock:
            if channel not in self.channels:
                self.channels[channel] = set()
            self.channels[channel].add(connection_id)

    async def unsubscribe(self, connection_id: str, channel: str):
        async with self._lock:
            if channel not in self.channels:
                return
            self.channels[channel].discard(connection_id)
            if not self.channels[channel]:
                del self.channels[channel]

    # -------------------------
    # Broadcast
    # -------------------------
    async def broadcast_channel(self, channel: str, message: dict[str, Any]):
        async with self._lock:
            subscribers = set(self.channels.get(channel, set()))
        dead: list[str] = []
        for cid in subscribers:
            ws = self.connections.get(cid)
            if not ws:
                dead.append(cid)
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(cid)
        for cid in dead:
            await self.disconnect(cid)

    async def broadcast_all(self, message: dict[str, Any]):
        async with self._lock:
            ids = list(self.connections.keys())
        dead: list[str] = []
        for cid in ids:
            ws = self.connections.get(cid)
            if not ws:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(cid)
        for cid in dead:
            await self.disconnect(cid)

    # -------------------------
    # Mensaje directo
    # -------------------------
    async def send_to_connection(self, connection_id: str, message: dict[str, Any]) -> bool:
        ws = self.connections.get(connection_id)
        if not ws:
            return False
        try:
            await ws.send_json(message)
            return True
        except Exception:
            await self.disconnect(connection_id)
            return False

    # -------------------------
    # Handlers
    # -------------------------
    def register_message_handler(self, event_name: str, handler: MessageHandler):
        self.message_handlers[event_name] = handler

    async def handle_message(self, connection_id: str, message: dict[str, Any]):
        event = message.get("event")
        data = message.get("data")
        if not event:
            return
        handler = self.message_handlers.get(event)
        if not handler:
            self._log("warning", f"No handler para evento {event}")
            return
        ws = self.connections.get(connection_id)
        if not ws:
            return
        try:
            await handler(connection_id, ws, data)
        except Exception as e:
            self._log("error", f"Error en handler {event}: {e}")

    # -------------------------
    # Datos iniciales
    # -------------------------
    def register_initial_data(self, event_name: str, callback: InitialDataCallback | Any):
        self.initial_data_callbacks.append((event_name, callback))

    # -------------------------
    # Metadata
    # -------------------------
    def get_metadata(self, connection_id: str) -> dict[str, Any] | None:
        return self.metadata.get(connection_id)

    def get_websocket(self, connection_id: str) -> WebSocket | None:
        return self.connections.get(connection_id)

    # -------------------------
    # Devuelve todos los datos para depuración
    # -------------------------
    async def get_all_data(self) -> dict[str, Any]:
        async with self._lock:
            data = {
                "connections": list(self.connections.keys()),
                "channels": {ch: list(ids) for ch, ids in self.channels.items()},
                "metadata": self.metadata.copy(),
                "message_handlers": list(self.message_handlers.keys()),
                "initial_data_callbacks": [ev for ev, _ in self.initial_data_callbacks]
            }
        return data