#!/usr/bin/env sh
# Approval-required runbook. It deliberately does not possess deployment credentials.
set -eu
: "${INCIDENT_ID:?Set INCIDENT_ID}"
: "${APPROVER:?Set APPROVER to the named on-call approver}"

echo "Rollback authorized by $APPROVER for incident $INCIDENT_ID."
echo "In Render: deploy the last known-good release, then run verify-recovery.sh."
echo "Record the Render deployment ID and approver in incidents/$INCIDENT_ID/action.json."
