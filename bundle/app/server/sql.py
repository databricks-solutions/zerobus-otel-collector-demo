"""
Thin wrapper around the SQL Warehouse Statement Execution API.

Uses synchronous mode with a generous wait timeout, then polls if the result
isn't ready. Supports parameterized statements.
"""

from __future__ import annotations

import asyncio
from typing import Any, Optional

import httpx

from .config import get_warehouse_id, get_workspace_host

API_PATH = "/api/2.0/sql/statements"
POLL_INTERVAL_SEC = 1.0
MAX_POLL_SEC = 60.0


def _to_param(name: str, value: Any) -> dict:
    """Convert a Python value to a SQL Statement Execution parameter."""
    if value is None:
        return {"name": name, "value": None, "type": "STRING"}
    if isinstance(value, bool):
        return {"name": name, "value": str(value).lower(), "type": "BOOLEAN"}
    if isinstance(value, int):
        return {"name": name, "value": str(value), "type": "BIGINT"}
    if isinstance(value, float):
        return {"name": name, "value": str(value), "type": "DOUBLE"}
    return {"name": name, "value": str(value), "type": "STRING"}


def _shape_response(payload: dict) -> dict:
    """Return {columns, rows, statement_id, state}.

    Columns: list of {name, type_text}.
    Rows: list of dicts keyed by column name. Values stay as strings (the
    Statement API returns them that way for JSON_ARRAY format); the caller can
    coerce as needed.
    """
    manifest = payload.get("manifest") or {}
    schema = manifest.get("schema") or {}
    columns = [
        {"name": c.get("name"), "type_text": c.get("type_text") or c.get("type_name")}
        for c in (schema.get("columns") or [])
    ]
    result = payload.get("result") or {}
    data_array = result.get("data_array") or []
    col_names = [c["name"] for c in columns]
    rows = [
        {col_names[i]: (row[i] if i < len(row) else None) for i in range(len(col_names))}
        for row in data_array
    ]
    return {
        "columns": columns,
        "rows": rows,
        "statement_id": payload.get("statement_id"),
        "state": (payload.get("status") or {}).get("state"),
    }


async def execute_statement(
    sql: str,
    parameters: Optional[list[dict]] = None,
    *,
    token: str,
    catalog: Optional[str] = None,
    schema: Optional[str] = None,
    row_limit: int = 10_000,
) -> dict:
    """Run a SQL statement on the configured warehouse and return shaped result.

    `token` is the bearer token to authenticate with — see
    `server.config.get_user_token` for how callers should obtain it.
    """
    host = get_workspace_host()
    warehouse_id = get_warehouse_id()
    url = f"{host}{API_PATH}"

    body: dict[str, Any] = {
        "warehouse_id": warehouse_id,
        "statement": sql,
        "wait_timeout": "30s",
        "on_wait_timeout": "CONTINUE",
        "format": "JSON_ARRAY",
        "disposition": "INLINE",
        "row_limit": row_limit,
    }
    if parameters:
        body["parameters"] = parameters
    if catalog:
        body["catalog"] = catalog
    if schema:
        body["schema"] = schema

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(url, json=body, headers=headers)
        if resp.status_code >= 400:
            raise RuntimeError(
                f"SQL Statement API error ({resp.status_code}): {resp.text}"
            )
        payload = resp.json()
        statement_id = payload.get("statement_id")
        state = (payload.get("status") or {}).get("state")

        # Poll if not ready
        elapsed = 0.0
        while state in ("PENDING", "RUNNING") and elapsed < MAX_POLL_SEC:
            await asyncio.sleep(POLL_INTERVAL_SEC)
            elapsed += POLL_INTERVAL_SEC
            poll_url = f"{host}{API_PATH}/{statement_id}"
            poll = await client.get(poll_url, headers=headers)
            if poll.status_code >= 400:
                raise RuntimeError(
                    f"SQL Statement poll error ({poll.status_code}): {poll.text}"
                )
            payload = poll.json()
            state = (payload.get("status") or {}).get("state")

        if state != "SUCCEEDED":
            err = (payload.get("status") or {}).get("error") or {}
            raise RuntimeError(
                f"SQL statement did not succeed (state={state}): "
                f"{err.get('message') or 'unknown error'}"
            )

        return _shape_response(payload)


def to_params(named: dict[str, Any]) -> list[dict]:
    """Convert a Python dict to SQL Statement parameters."""
    return [_to_param(k, v) for k, v in named.items()]
