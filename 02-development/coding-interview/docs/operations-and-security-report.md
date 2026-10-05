# PairPad operations and security report

## Service and user impact

PairPad is a FastAPI service backed by Postgres. Its important user journey is creating or
joining a collaborative interview session. The operational alert fires when more than 5% of
`/api/sessions` requests return 5xx over five minutes. It identifies the service, journey,
severity, and runbook so the alert is actionable rather than a generic infrastructure signal.

## Observability design

The API emits OpenTelemetry FastAPI request traces and metrics only when
`OTEL_EXPORTER_OTLP_ENDPOINT` is configured. This avoids a telemetry dependency for the
existing zero-configuration local workflow. Set it to `localhost:4317` when the local
collector is running, or to the production collector's private address. Interview code,
WebRTC payloads, database connection strings, and authorization values must never be placed in
telemetry attributes or logs.

Start the local backends with:

```powershell
docker compose -f observability/compose.yaml up -d
$env:OTEL_EXPORTER_OTLP_ENDPOINT = "localhost:4317"
npm run dev
```

Grafana is available at `http://localhost:3000`; add Prometheus (`http://prometheus:9090`),
Loki (`http://loki:3100`), and Tempo (`http://tempo:3200`) data sources, then import
`observability/dashboard.json`. `collector.yaml` receives OTLP, exposes metrics to Prometheus,
and forwards traces to Tempo. Loki is included as the log store; production log shipping must
use its OTLP endpoint or an approved log collector with the same redaction policy.

## Incident response

On an alert, run `incident-response/collect-evidence.sh INCIDENT-ID` with a read-only
Prometheus URL. It produces a repeatable evidence packet containing the deployed target info,
error rate, and p95 latency. Supply that packet, not live production credentials, to a model
using `responder-task.md`. Validate its response against `response.schema.json` and evaluate
`autonomy-policy.yaml` outside the model.

The only contemplated remediation is a last-known-good rollback, and it always requires a
named human approver. `rollback.sh` intentionally contains no deployment credential or API
call. After a human performs the Render rollback, `verify-recovery.sh` checks health and the
on-call engineer confirms alert resolution. The evidence, model/configuration, policy decision,
actual command, and verification belong under `incident-response/incidents/INCIDENT-ID/`.

## Security review

`security-audit/audit-brief.md` combines Semgrep with model review and a human disposition.
`capability-table.md` inventories the responder's permitted and prohibited powers. Findings use
the schema in `findings.schema.json`. Scan output and incident records are redacted before
storage, because the responder and the observability system are both part of PairPad's attack
surface.
