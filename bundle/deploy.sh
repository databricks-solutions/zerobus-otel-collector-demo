#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

TARGET="${1:-dev}"
shift || true

echo "==> Building frontend"
databricks bundle run frontend_build --target "$TARGET" "$@"

echo "==> Deploying bundle to $TARGET"
databricks bundle deploy --target "$TARGET" "$@"

echo "==> Running silver pipelines"
databricks bundle run logs_silver    --target "$TARGET" --no-wait "$@"
databricks bundle run spans_silver   --target "$TARGET" --no-wait "$@"
databricks bundle run metrics_silver --target "$TARGET" "$@"
