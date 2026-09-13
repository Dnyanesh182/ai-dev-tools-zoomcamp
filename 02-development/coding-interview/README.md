# PairPad — collaborative coding interviews

PairPad creates shareable coding rooms. Participants edit Python or JavaScript together through WebSockets. PrismJS provides syntax highlighting; Python runs through **Pyodide (WASM)** in the participant's browser, never on the server.

## Run

```powershell
py -m pip install -r requirements.txt
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The frontend calls FastAPI at port 8000.

## Verify

```powershell
npm test
npm run build
```

## Container

```powershell
docker build -t pairpad .
docker run -p 8000:8000 pairpad
```

Open `http://127.0.0.1:8000`. The container serves both the built frontend and FastAPI backend from one port.

## Deploy

The included `render.yaml` configures a Docker Web Service. In Render, create a Blueprint from this repository, select `02-development/coding-interview/render.yaml`, and deploy. It uses the single container above; no server-side code execution is enabled.

## Homework answers

1. Initial prompt: “Build a full-stack collaborative coding interview platform with shareable rooms, WebSocket edits, JavaScript/Python highlighting, browser-only code execution, persistence, tests, documentation, and Docker.”
2. Tests: `npm test`
3. Dev command: `concurrently "uvicorn backend.main:app --reload --port 8000" "npm --prefix frontend run dev"`
4. Highlighting: PrismJS
5. Python WASM: Pyodide
6. Docker base image: `node:22-bookworm-slim`
7. Deployment: Render (configure a Docker Web Service; credentials are intentionally not committed).
