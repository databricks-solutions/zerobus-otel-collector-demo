"""
Genie Conversation API client.

The SDK doesn't expose Genie yet, so we call the REST endpoints directly with
httpx using the workspace OAuth token.

Relevant endpoints:
- POST /api/2.0/genie/spaces/{space_id}/start-conversation
- POST /api/2.0/genie/spaces/{space_id}/conversations/{conv_id}/messages
- GET  /api/2.0/genie/spaces/{space_id}/conversations/{conv_id}/messages/{msg_id}
- GET  /api/2.0/genie/spaces/{space_id}/conversations/{conv_id}/messages/{msg_id}/attachments/{att_id}/query-result
"""

from __future__ import annotations

from typing import Any, Optional

import httpx

from .config import get_genie_space_id, get_workspace_host

GENIE_BASE = "/api/2.0/genie/spaces"


def _require_space_id() -> str:
    space_id = get_genie_space_id()
    if not space_id:
        raise RuntimeError(
            "GENIE_SPACE_ID is not set. Create a Genie Space and set the env var."
        )
    return space_id


def _headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


async def start_conversation(question: str, *, token: str) -> dict:
    """Start a new Genie conversation. Returns {conversation_id, message_id}."""
    space_id = _require_space_id()
    url = f"{get_workspace_host()}{GENIE_BASE}/{space_id}/start-conversation"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, headers=_headers(token), json={"content": question})
        if resp.status_code >= 400:
            raise RuntimeError(f"Genie start-conversation error ({resp.status_code}): {resp.text}")
        payload = resp.json()
        # Response shape: {conversation_id, message_id, conversation: {...}, message: {...}}
        conv = payload.get("conversation") or {}
        msg = payload.get("message") or {}
        return {
            "conversation_id": payload.get("conversation_id") or conv.get("id"),
            "message_id": payload.get("message_id") or msg.get("id"),
        }


async def post_message(conversation_id: str, question: str, *, token: str) -> dict:
    """Append a message to an existing Genie conversation."""
    space_id = _require_space_id()
    url = (
        f"{get_workspace_host()}{GENIE_BASE}/{space_id}"
        f"/conversations/{conversation_id}/messages"
    )
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, headers=_headers(token), json={"content": question})
        if resp.status_code >= 400:
            raise RuntimeError(f"Genie post-message error ({resp.status_code}): {resp.text}")
        payload = resp.json()
        return {
            "conversation_id": conversation_id,
            "message_id": payload.get("message_id") or payload.get("id"),
        }


async def get_message(conversation_id: str, message_id: str, *, token: str) -> dict:
    """Fetch the current state of a Genie message (status + attachments)."""
    space_id = _require_space_id()
    url = (
        f"{get_workspace_host()}{GENIE_BASE}/{space_id}"
        f"/conversations/{conversation_id}/messages/{message_id}"
    )
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url, headers=_headers(token))
        if resp.status_code >= 400:
            raise RuntimeError(f"Genie get-message error ({resp.status_code}): {resp.text}")
        return resp.json()


async def get_query_result(
    conversation_id: str, message_id: str, attachment_id: str, *, token: str
) -> dict:
    """Fetch the SQL execution result for a Genie query attachment."""
    space_id = _require_space_id()
    url = (
        f"{get_workspace_host()}{GENIE_BASE}/{space_id}"
        f"/conversations/{conversation_id}/messages/{message_id}"
        f"/attachments/{attachment_id}/query-result"
    )
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url, headers=_headers(token))
        if resp.status_code >= 400:
            raise RuntimeError(
                f"Genie query-result error ({resp.status_code}): {resp.text}"
            )
        return resp.json()


def shape_message(message: dict) -> dict:
    """Pull the interesting bits out of a Genie message payload.

    Returns:
      {
        status: str,
        text_response: Optional[str],
        sql: Optional[str],
        query_description: Optional[str],
        attachment_id: Optional[str],
        error: Optional[str],
      }
    """
    status = message.get("status")
    attachments = message.get("attachments") or []

    text_response: Optional[str] = None
    sql: Optional[str] = None
    query_description: Optional[str] = None
    attachment_id: Optional[str] = None

    for att in attachments:
        if att.get("text") and (att["text"].get("content")):
            text_response = att["text"]["content"]
        if att.get("query"):
            q = att["query"]
            sql = q.get("query") or sql
            query_description = q.get("description") or query_description
            attachment_id = att.get("attachment_id") or attachment_id

    err = message.get("error")
    error_msg: Optional[str] = None
    if err:
        if isinstance(err, dict):
            error_msg = err.get("error") or err.get("message") or str(err)
        else:
            error_msg = str(err)

    return {
        "status": status,
        "text_response": text_response,
        "sql": sql,
        "query_description": query_description,
        "attachment_id": attachment_id,
        "error": error_msg,
    }


def shape_query_result(result: dict) -> dict:
    """Extract columns + rows from a Genie query-result payload.

    Genie wraps a Statement API response. Format:
      result.statement_response.manifest.schema.columns
      result.statement_response.result.data_array
      result.statement_response.status.state
    """
    sr = result.get("statement_response") or result
    manifest = sr.get("manifest") or {}
    schema = manifest.get("schema") or {}
    columns = [
        {"name": c.get("name"), "type_text": c.get("type_text") or c.get("type_name")}
        for c in (schema.get("columns") or [])
    ]
    data = (sr.get("result") or {}).get("data_array") or []
    col_names = [c["name"] for c in columns]
    rows = [
        {col_names[i]: (row[i] if i < len(row) else None) for i in range(len(col_names))}
        for row in data
    ]
    state = (sr.get("status") or {}).get("state")
    return {"columns": columns, "rows": rows, "state": state}


# Convenience kept for type-checkers
Any = Any  # noqa: E501
