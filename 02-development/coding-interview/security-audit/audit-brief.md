# PairPad security audit brief

Scope: the FastAPI API, WebSocket collaboration channel, Docker image, CI deployment
workflow, and the incident responder assets. Do not test against the public service
without approval. Never put session code, WebRTC offers, credentials, or database URLs in
an audit report.

Run deterministic checks first:

```sh
semgrep scan --config p/default backend frontend .github
```

Then ask a reviewer to assess authentication boundaries, CORS origins, WebSocket input
validation, dependency changes, logging/redaction, and responder capability drift. Record
each finding using `findings.schema.json`; a human must set the final disposition.
