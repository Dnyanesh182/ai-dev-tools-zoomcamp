# Testing PairPad

## Fast integration suite

`npm test` runs `tests/integration/test_collaboration.py`. It starts the FastAPI application in-process
with a disposable SQLite database and exercises session creation, persistence, and two
connected WebSocket clients. This is deliberately an integration test: it crosses the API,
database, and collaboration boundary rather than testing helper functions alone.

```powershell
npm test
```

For the production database path, start the full stack and use the app at
`http://localhost:8000`:

```powershell
docker compose up --build
```

The health endpoint is `GET /healthz`; it is used by deployment smoke tests.

## What CI verifies

Every pull request and push to `main` installs pinned dependencies, runs the integration
suite, builds the frontend, and builds the container image. See `.github/workflows/ci.yml`.
