"""Genie endpoints — proxy to the Genie Conversation API."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .. import genie

router = APIRouter(prefix="/api/genie", tags=["genie"])


class ConversationRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None


@router.post("/conversation")
async def post_conversation(body: ConversationRequest):
    if not body.question or not body.question.strip():
        raise HTTPException(status_code=400, detail="question is required")
    try:
        if body.conversation_id:
            res = await genie.post_message(body.conversation_id, body.question)
        else:
            res = await genie.start_conversation(body.question)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    return res


@router.get("/message/{conversation_id}/{message_id}")
async def get_message(conversation_id: str, message_id: str):
    try:
        message = await genie.get_message(conversation_id, message_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    shaped = genie.shape_message(message)
    payload: dict = {
        "status": shaped["status"],
        "text_response": shaped["text_response"],
        "sql": shaped["sql"],
        "query_description": shaped["query_description"],
        "error": shaped["error"],
    }

    # If completed and we have a query attachment, fetch the rows.
    if (
        shaped["status"] == "COMPLETED"
        and shaped["attachment_id"]
        and shaped["sql"]
    ):
        try:
            qr = await genie.get_query_result(
                conversation_id, message_id, shaped["attachment_id"]
            )
            shaped_qr = genie.shape_query_result(qr)
            # If query is still running, surface a softer status to the FE.
            if shaped_qr["state"] in ("PENDING", "RUNNING"):
                payload["status"] = "QUERY_RUNNING"
            else:
                payload["columns"] = shaped_qr["columns"]
                payload["rows"] = shaped_qr["rows"]
        except Exception as e:
            payload["error"] = (payload["error"] or "") + f" | query-result: {e}"

    return payload
