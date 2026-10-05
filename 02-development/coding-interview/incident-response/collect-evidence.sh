#!/usr/bin/env sh
# Read-only evidence collection. Requires PROMETHEUS_URL and optional GRAFANA_URL.
set -eu

incident_id="${1:?usage: collect-evidence.sh INCIDENT-ID}"
case "$incident_id" in
  *[!A-Za-z0-9_-]*|'') echo "Incident ID must contain only letters, numbers, _ or -" >&2; exit 2 ;;
esac

: "${PROMETHEUS_URL:?Set PROMETHEUS_URL, for example http://localhost:9090}"
output_dir="$(dirname "$0")/incidents/$incident_id"
mkdir -p "$output_dir"

query() {
  name="$1"
  expression="$2"
  curl --fail --silent --show-error --get "$PROMETHEUS_URL/api/v1/query" \
    --data-urlencode "query=$expression" > "$output_dir/$name.json"
}

query deployment_version 'target_info{service_name="pairpad-api"}'
query session_api_error_rate 'sum(rate(http_server_request_duration_milliseconds_count{service_name="pairpad-api",http_route=~"/api/sessions.*",http_response_status_code=~"5.."}[5m])) / clamp_min(sum(rate(http_server_request_duration_milliseconds_count{service_name="pairpad-api",http_route=~"/api/sessions.*"}[5m])), 1)'
query session_api_latency 'histogram_quantile(0.95, sum by (le) (rate(http_server_request_duration_milliseconds_bucket{service_name="pairpad-api",http_route=~"/api/sessions.*"}[5m])))'

cat > "$output_dir/manifest.json" <<EOF
{"incident_id":"$incident_id","collected_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","collector":"collect-evidence.sh","queries":["deployment_version","session_api_error_rate","session_api_latency"]}
EOF
echo "Evidence written to $output_dir"
