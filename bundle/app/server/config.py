"""
Dual-mode auth + config helpers.

- Local dev: uses Databricks CLI profile via WorkspaceClient(profile=...)
  Honors DATABRICKS_PROFILE env var if set, otherwise the SDK's default chain
  (which picks up DATABRICKS_HOST + DATABRICKS_TOKEN env vars too).
- Deployed: uses auto-injected service principal credentials. The presence of
  DATABRICKS_APP_NAME (set by the Apps runtime) flags this mode.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

from databricks.sdk import WorkspaceClient
from dotenv import load_dotenv

# Load .env file if present (local dev convenience).
load_dotenv()

IS_DATABRICKS_APP = bool(os.environ.get("DATABRICKS_APP_NAME"))


def _build_client() -> WorkspaceClient:
    """Create a WorkspaceClient for the current environment."""
    if IS_DATABRICKS_APP:
        # Apps runtime injects DATABRICKS_HOST + DATABRICKS_CLIENT_ID +
        # DATABRICKS_CLIENT_SECRET. The SDK picks them up automatically.
        return WorkspaceClient()

    profile = os.environ.get("DATABRICKS_PROFILE")
    if profile:
        return WorkspaceClient(profile=profile)
    # Fall back to default chain (respects DATABRICKS_HOST + DATABRICKS_TOKEN
    # env vars, then ~/.databrickscfg DEFAULT profile).
    return WorkspaceClient()


@lru_cache(maxsize=1)
def get_workspace_client() -> WorkspaceClient:
    return _build_client()


def get_workspace_host() -> str:
    """Return workspace URL with https:// scheme.

    In Databricks Apps, DATABRICKS_HOST is just a hostname (no scheme), so we
    normalize it. Locally, the SDK includes the scheme.
    """
    if IS_DATABRICKS_APP:
        host = os.environ.get("DATABRICKS_HOST", "")
        if host and not host.startswith("http"):
            host = f"https://{host}"
        return host.rstrip("/")
    client = get_workspace_client()
    return (client.config.host or "").rstrip("/")


def get_oauth_token() -> str:
    """Return a bearer token suitable for direct REST calls.

    Works for OAuth/U2M (where w.config.token is None) and PAT auth.
    """
    client = get_workspace_client()
    if client.config.token:
        return client.config.token
    auth_headers = client.config.authenticate()
    if auth_headers and "Authorization" in auth_headers:
        return auth_headers["Authorization"].replace("Bearer ", "")
    raise RuntimeError("Unable to acquire Databricks OAuth token")


# --- Required app config -----------------------------------------------------


def get_warehouse_id() -> str:
    val = os.environ.get("DATABRICKS_WAREHOUSE_ID", "").strip()
    if not val:
        raise RuntimeError(
            "DATABRICKS_WAREHOUSE_ID is not set. Set it in app.yaml or your "
            "local environment."
        )
    return val


def get_genie_space_id() -> Optional[str]:
    val = os.environ.get("GENIE_SPACE_ID", "").strip()
    return val or None


def get_otel_catalog() -> str:
    return os.environ.get("OTEL_CATALOG", "otel").strip()


def get_otel_schema() -> str:
    return os.environ.get("OTEL_SCHEMA", "kubernetes_otel_silver").strip()


def fq(table: str) -> str:
    """Fully-qualify a table name in the configured catalog/schema."""
    return f"`{get_otel_catalog()}`.`{get_otel_schema()}`.`{table}`"
