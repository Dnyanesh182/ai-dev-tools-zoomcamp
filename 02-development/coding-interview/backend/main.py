import json, sqlite3, uuid
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB = Path(__file__).with_name("pairpad.db")
app = FastAPI(title="PairPad API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])
clients: dict[str, list[WebSocket]] = {}

class Update(BaseModel):
    code: str = Field(max_length=20000)
    language: str = Field(pattern="^(python|javascript)$")

def conn():
    db = sqlite3.connect(DB); db.row_factory = sqlite3.Row
    db.execute("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, code TEXT NOT NULL, language TEXT NOT NULL)")
    return db

def read(session_id):
    db = conn(); row = db.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone(); db.close()
    if not row: raise HTTPException(404, "Session not found")
    return dict(row)

def save(session_id, update):
    db = conn(); result = db.execute("UPDATE sessions SET code=?, language=? WHERE id=?", (update.code, update.language, session_id)); db.commit(); db.close()
    if not result.rowcount: raise HTTPException(404, "Session not found")
    return read(session_id)

@app.post("/api/sessions", status_code=201)
def create_session():
    session_id = uuid.uuid4().hex[:10]; record = {"id": session_id, "code": "# Start coding here\nprint('Hello, candidate!')", "language": "python"}
    db = conn(); db.execute("INSERT INTO sessions VALUES (:id,:code,:language)", record); db.commit(); db.close()
    return {**record, "share_url": f"/session/{session_id}"}

@app.get("/api/sessions/{session_id}")
def get_session(session_id: str): return read(session_id)

async def broadcast(session_id, payload):
    stale=[]
    for socket in clients.get(session_id, []):
        try: await socket.send_json(payload)
        except Exception: stale.append(socket)
    clients[session_id] = [s for s in clients.get(session_id, []) if s not in stale]

@app.put("/api/sessions/{session_id}")
async def update_session(session_id: str, update: Update):
    record = save(session_id, update); await broadcast(session_id, {"type":"document", **record}); return record

@app.websocket("/ws/sessions/{session_id}")
async def collaborate(socket: WebSocket, session_id: str):
    try: record = read(session_id)
    except HTTPException: await socket.close(code=4404); return
    await socket.accept(); clients.setdefault(session_id, []).append(socket); await socket.send_json({"type":"document", **record})
    try:
        while True:
            message = json.loads(await socket.receive_text())
            if message.get("type") == "update":
                record = save(session_id, Update(code=message["code"], language=message["language"])); await broadcast(session_id, {"type":"document", **record})
    except WebSocketDisconnect: pass
    finally: clients[session_id] = [s for s in clients.get(session_id, []) if s is not socket]

DIST = Path(__file__).parent.parent / "frontend" / "dist"
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/")
    @app.get("/session/{session_id}")
    def frontend(session_id: str | None = None):
        return FileResponse(DIST / "index.html")
