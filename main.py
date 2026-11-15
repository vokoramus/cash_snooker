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
        self.rooms: Dict[str, List[WebSocket]] = {}

    async def connect(self, room_id: str, ws: WebSocket) -> int:
        await ws.accept()
        players = self.rooms.setdefault(room_id, [])

        if len(players) >= 2:
            await ws.send_json({"type": "room_full"})
            await ws.close()
            return -1

        players.append(ws)
        player_idx = len(players) - 1

        await ws.send_json({
            "type": "joined",
            "roomId": room_id,
            "playerIndex": player_idx,
            "playersCount": len(players)
        })

        await self.broadcast(room_id, {
            "type": "room_status",
            "playersCount": len(players)
        })
        return player_idx

    def disconnect(self, room_id: str, ws: WebSocket) -> None:
        players = self.rooms.get(room_id)
        if not players:
            return
        if ws in players:
            players.remove(ws)
        if not players:
            self.rooms.pop(room_id, None)

    async def broadcast(self, room_id: str, message: dict, exclude: WebSocket | None = None) -> None:
        players = self.rooms.get(room_id, [])
        for client in list(players):
            if client is not exclude:
                await client.send_json(message)


manager = RoomManager()


async def handle_ws(websocket: WebSocket, room_id: str) -> None:
    clean_room = room_id.strip().lower() or "default"
    player_idx = await manager.connect(clean_room, websocket)
    if player_idx == -1:
        return

    try:
        while True:
            data = await websocket.receive_json()
            data["sender"] = player_idx
            await manager.broadcast(clean_room, data, exclude=websocket)
    except WebSocketDisconnect:
        manager.disconnect(clean_room, websocket)
        await manager.broadcast(clean_room, {"type": "player_left"})


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
