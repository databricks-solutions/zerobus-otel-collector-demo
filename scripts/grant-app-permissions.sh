#!/usr/bin/env bash
# Grant USE_CATALOG and USE_SCHEMA to the app's service principal.
#
# DABs `uc_securable` resources only support TABLE/FUNCTION/VOLUME/CONNECTION,
# so we can declaratively grant SELECT on tables but not the parent USE_*.
# This script fills the gap. Idempotent — safe to re-run on every deploy.
#
# Usage:
#   APP_NAME=otel-observability \
#   CATALOG=otel \
#   SCHEMA=dev_<user_short>_kubernetes_otel_silver \
#   WAREHOUSE_ID=<your-warehouse-id> \
#     scripts/grant-app-permissions.sh
set -euo pipefail

: "${APP_NAME:?APP_NAME is required}"
: "${CATALOG:?CATALOG is required}"
: "${SCHEMA:?SCHEMA is required}"
: "${WAREHOUSE_ID:?WAREHOUSE_ID is required}"

# Look up the app's service principal application ID.
sp_id=$(databricks apps get "$APP_NAME" --output json | python3 -c '
import json, sys
app = json.load(sys.stdin)
sp = app.get("service_principal_client_id") or app.get("service_principal_id") or ""
if not sp:
    raise SystemExit("could not find service_principal_client_id on app")
print(sp)
')

echo "Granting USE_CATALOG and USE_SCHEMA to app SP $sp_id..."

# Build a JSON request body via python (bash brace expansion makes inline
# dict literals unsafe).
build_body() {
  local stmt="$1"
  python3 - "$WAREHOUSE_ID" "$stmt" <<'PY'
import json, sys
warehouse_id, statement = sys.argv[1], sys.argv[2]
print(json.dumps({
    "warehouse_id": warehouse_id,
    "statement": statement,
    "wait_timeout": "30s",
}))
PY
}

run_sql() {
  local stmt="$1"
  local body
  body=$(build_body "$stmt")
  databricks api post /api/2.0/sql/statements --json "$body" >/dev/null
}

run_sql "GRANT USE CATALOG ON CATALOG \`$CATALOG\` TO \`$sp_id\`"
run_sql "GRANT USE SCHEMA ON SCHEMA \`$CATALOG\`.\`$SCHEMA\` TO \`$sp_id\`"

echo "Done."
