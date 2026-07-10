"""
Auth + config helpers.

UC-governed calls (SQL, Genie) use `get_user_token()`, which returns the
signed-in user's own forwarded token (on-behalf-of-user / OBO auth) when
deployed as a Databricks App. The service-principal-based WorkspaceClient
below is only used locally (dev auth chain) and as the source of that
fallback token when running outside Databricks Apps.

- Local dev: uses Databricks CLI profile via WorkspaceClient(profile=...)
  Honors DATABRICKS_PROFILE env var if set, otherwise the SDK's default chain
  (which picks up DATABRICKS_HOST + DATABRICKS_TOKEN env vars too).
- Deployed: the SDK auto-picks-up injected service principal credentials, but
  those are no longer used for data queries — see `get_user_token()`. The
  presence of DATABRICKS_APP_NAME (set by the Apps runtime) flags this mode.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

from databricks.sdk import WorkspaceClient
from dotenv import load_dotenv
from fastapi import HTTPException, Request

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


def get_user_token(request: Request) -> str:
    """Return the bearer token to use for UC-governed calls on this request.

    Deployed apps: Databricks Apps forwards the signed-in user's own downscoped
    token via the x-forwarded-access-token header once user authorization (OBO)
    is enabled for the app with the 'sql' and 'dashboards.genie' scopes. We use
    that token so SQL/Genie calls are governed by the viewing user's own UC
    grants rather than the app's service principal.

    Local dev: that header doesn't exist, so fall back to the developer's own
    CLI-profile/token-based credentials (already effectively "as the user").
    """
    forwarded = request.headers.get("x-forwarded-access-token")
    if forwarded:
        return forwarded
    if IS_DATABRICKS_APP:
        raise HTTPException(
            status_code=500,
            detail=(
                "Missing x-forwarded-access-token header. Ensure user authorization "
                "is enabled for this app (with the 'sql' and 'dashboards.genie' "
                "scopes) in Compute > Apps > <app> > Edit, and that the app has been "
                "restarted since enabling it."
            ),
        )
    return get_oauth_token()


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
