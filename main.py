from pathlib import Path
from typing import Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="Cash Snooker Server")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

"""запуск локально:
uvicorn main:app --reload --port 8001
"""


class RoomManager:
    def __init__(self) -> None:
        self.rooms: Dict[str, dict] = {}

    def _get_room(self, room_id: str) -> dict:
        return self.rooms.setdefault(room_id, {"players": [], "spectators": []})

    async def connect(self, room_id: str, ws: WebSocket) -> int:
        await ws.accept()
        room = self._get_room(room_id)
        players: List[WebSocket] = room["players"]
        spectators: List[WebSocket] = room["spectators"]

        if len(players) < 2:
            players.append(ws)
            role_idx = len(players) - 1  # 0 или 1
        else:
            spectators.append(ws)
            role_idx = -1  # Зритель

        await ws.send_json({
            "type": "joined",
            "roomId": room_id,
            "playerIndex": role_idx,
            "playersCount": len(players),
            "spectatorsCount": len(spectators)
        })

        await self.broadcast(room_id, {
            "type": "room_status",
            "playersCount": len(players),
            "spectatorsCount": len(spectators)
        })
        return role_idx

    def disconnect(self, room_id: str, ws: WebSocket) -> tuple[bool, int, int]:
        room = self.rooms.get(room_id)
        if not room:
            return False, 0, 0

        was_player = False
        if ws in room["players"]:
            room["players"].remove(ws)
            was_player = True
        elif ws in room["spectators"]:
            room["spectators"].remove(ws)

        p_count = len(room["players"])
        s_count = len(room["spectators"])

        if p_count == 0 and s_count == 0:
            self.rooms.pop(room_id, None)

        return was_player, p_count, s_count

    async def broadcast(self, room_id: str, message: dict, exclude: WebSocket | None = None) -> None:
        room = self.rooms.get(room_id)
        if not room:
            return
        all_clients = list(room["players"]) + list(room["spectators"])
        for client in all_clients:
            if client is exclude:
                continue
            try:
                await client.send_json(message)
            except Exception:
                self.disconnect(room_id, client)


manager = RoomManager()


async def handle_ws(websocket: WebSocket, room_id: str) -> None:
    clean_room = room_id.strip().lower() or "default"
    role_idx = await manager.connect(clean_room, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            # Зрителям (role_idx == -1) запрещаем рассылать игровые команды в комнату
            if role_idx == -1:
                continue
            data["sender"] = role_idx
            await manager.broadcast(clean_room, data, exclude=websocket)
    except WebSocketDisconnect:
        was_player, p_count, s_count = manager.disconnect(clean_room, websocket)
        if was_player:
            await manager.broadcast(clean_room, {
                "type": "player_left",
                "playersCount": p_count,
                "spectatorsCount": s_count
            })
        else:
            await manager.broadcast(clean_room, {
                "type": "room_status",
                "playersCount": p_count,
                "spectatorsCount": s_count
            })


@app.websocket("/ws/{room_id}")
async def websocket_root(websocket: WebSocket, room_id: str) -> None:
    await handle_ws(websocket, room_id)


@app.websocket("/cash-snooker/ws/{room_id}")
async def websocket_prefixed(websocket: WebSocket, room_id: str) -> None:
    await handle_ws(websocket, room_id)


@app.get("/")
@app.get("/cash-snooker")
@app.get("/cash-snooker/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/cash-snooker", StaticFiles(directory=STATIC_DIR), name="static_prefixed")
app.mount("/", StaticFiles(directory=STATIC_DIR), name="static_root")
