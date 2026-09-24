import json
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.database import SQLITE_DB, connection, placeholder, row_to_dict
from backend.migrate import apply_migrations


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Apply pending schema changes before the service accepts traffic."""
    apply_migrations()
    yield


# Kept as a public compatibility alias for the local test suite.
DB = SQLITE_DB
app = FastAPI(title="PairPad API", version="1.0.0", lifespan=lifespan)
local_cors_origins = {"http://localhost:5173", "http://127.0.0.1:5173"}
configured_cors_origins = {
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
}
cors_origins = sorted(local_cors_origins | configured_cors_origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
clients: dict[str, list[WebSocket]] = {}


class Update(BaseModel):
    code: str = Field(max_length=20000)
    language: str = Field(pattern="^(python|javascript)$")


class WebRTCSignal(BaseModel):
    type: str = "webrtc-signal"
    peerId: str = Field(min_length=1, max_length=100)
    remotePeerId: str | None = Field(default=None, min_length=1, max_length=100)
    signalType: str = Field(pattern="^(offer|answer|candidate)$")
    offer: dict | None = None
    answer: dict | None = None
    candidate: dict | None = None


def read(session_id):
    with connection() as db:
        cursor = db.cursor()
        cursor.execute(placeholder("SELECT * FROM sessions WHERE id=?"), (session_id,))
        row = row_to_dict(cursor, cursor.fetchone())

    if not row:
        raise HTTPException(404, "Session not found")

    return row


def save(session_id, update):
    with connection() as db:
        cursor = db.cursor()
        cursor.execute(
            placeholder("UPDATE sessions SET code=?, language=? WHERE id=?"),
            (update.code, update.language, session_id),
        )
        updated = cursor.rowcount

    if not updated:
        raise HTTPException(404, "Session not found")

    return read(session_id)


@app.post("/api/sessions", status_code=201)
def create_session():
    session_id = uuid.uuid4().hex[:10]
    record = {
        "id": session_id,
        "code": "# Start coding here\nprint('Hello, candidate!')",
        "language": "python",
    }
    with connection() as db:
        db.cursor().execute(
            placeholder("INSERT INTO sessions (id, code, language) VALUES (?, ?, ?)"),
            (record["id"], record["code"], record["language"]),
        )

    return {**record, "share_url": f"/session/{session_id}"}


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    return read(session_id)


@app.get("/healthz")
def health_check():
    return {"status": "ok"}


async def broadcast(session_id, payload, exclude=None):
    stale = []

    for socket in clients.get(session_id, []):
        if socket is exclude:
            continue
        try:
            await socket.send_json(payload)
        except Exception:
            stale.append(socket)

    clients[session_id] = [
        socket for socket in clients.get(session_id, []) if socket not in stale
    ]


@app.put("/api/sessions/{session_id}")
async def update_session(session_id: str, update: Update):
    record = save(session_id, update)
    await broadcast(session_id, {"type": "document", **record})
    return record


@app.websocket("/ws/sessions/{session_id}")
async def collaborate(socket: WebSocket, session_id: str):
    try:
        record = read(session_id)
    except HTTPException:
        await socket.close(code=4404)
        return

    await socket.accept()
    clients.setdefault(session_id, []).append(socket)
    await socket.send_json({"type": "document", **record})

    try:
        while True:
            message = json.loads(await socket.receive_text())
            if message.get("type") == "update":
                record = save(
                    session_id,
                    Update(code=message["code"], language=message["language"]),
                )
                await broadcast(session_id, {"type": "document", **record})
            elif message.get("type") == "webrtc-signal":
                signal = WebRTCSignal(**message)
                payload = signal.model_dump(exclude_none=True)
                await broadcast(session_id, payload, exclude=socket)
    except WebSocketDisconnect:
        pass
    finally:
        clients[session_id] = [
            client for client in clients.get(session_id, []) if client is not socket
        ]


DIST = Path(__file__).parent.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/")
    @app.get("/session/{session_id}")
    def frontend(session_id: str | None = None):
        return FileResponse(DIST / "index.html")
