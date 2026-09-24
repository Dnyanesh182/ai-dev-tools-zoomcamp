# PairPad release process

1. Open a pull request. CI must pass its integration tests, frontend build, and Docker build.
2. Review the change and merge to `main`.
3. The production workflow triggers the Render deploy hook, then checks `/healthz`.
4. Confirm creating a session and opening its share link in the public service.

## Rollback

If the smoke test or manual check fails, use Render's dashboard to redeploy the last known-good
release. Then revert the offending Git commit and merge the revert so `main` matches the running
service. Database migrations are forward-only: provide a corrective migration rather than trying
to remove a migration already applied in production.
