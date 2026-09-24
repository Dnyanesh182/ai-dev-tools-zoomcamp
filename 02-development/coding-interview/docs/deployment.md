# Deploying PairPad

PairPad is a single web service plus Postgres. The application reads its connection string
from `DATABASE_URL` and runs its versioned SQL migrations before starting. SQLite remains the
zero-configuration local default only.

## Local production-like stack

```powershell
docker compose up --build
```

Open `http://localhost:8000`. Stop the stack with `docker compose down`; add `--volumes` only
when intentionally discarding local Postgres data.

## Render setup

1. Create a Render Blueprint from this repository and select
   `02-development/coding-interview/render.yaml` as its Blueprint path.
2. Review and deploy it. The Blueprint provisions the Docker web service and managed Postgres,
   and securely injects the database's private connection string as `DATABASE_URL`.
3. After provisioning completes, confirm the service responds at `/healthz`.
4. In GitHub, create the `production` environment, add `RENDER_DEPLOY_HOOK_URL` as its secret,
   and set `PAIRPAD_URL` (for example `https://pairpad.example.com`) as its environment variable.

After that, `.github/workflows/deploy.yml` triggers Render from `main` and retries the health
check for one minute. It intentionally fails when either value is absent, preventing a false
green deployment.

## Database migrations

Migration files live in `backend/migrations`. Add a new numbered, forward-only SQL file for a
schema change. The migration runner records applied filenames in `schema_migrations`; it is safe
to run repeatedly. Never edit a migration that has already reached production.
