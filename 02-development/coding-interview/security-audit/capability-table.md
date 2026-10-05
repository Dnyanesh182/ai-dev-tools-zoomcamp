# Responder capability inventory

| Capability | Purpose | Allowed | Guardrail |
| --- | --- | --- | --- |
| Read evidence packet | Diagnose impact | Yes | Fixed Prometheus queries only; session contents excluded |
| Read source at pinned revision | Compare recent changes | Yes | Repository read-only |
| Propose rollback | Recommend recovery | Yes | JSON-schema response; no execution authority |
| Trigger Render deployment | Recover service | No direct access | Named human approves and uses Render dashboard |
| Read secrets or production database | Investigate | No | No credentials supplied to responder |
| Modify code or configuration | Fix incident | No | Normal reviewed pull-request process |

Re-run Snyk Agent Scan (or an equivalent agent-capability inventory) whenever the responder,
its tools, model provider, or credential boundary changes.
