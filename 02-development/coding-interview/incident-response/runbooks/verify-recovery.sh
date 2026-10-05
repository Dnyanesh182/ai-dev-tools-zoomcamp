#!/usr/bin/env sh
set -eu
: "${PAIRPAD_URL:?Set PAIRPAD_URL to the deployed service URL}"

curl --fail --silent --show-error "$PAIRPAD_URL/healthz"
echo
echo "Health endpoint recovered. Confirm the session API error-rate alert has resolved before closing the incident."
