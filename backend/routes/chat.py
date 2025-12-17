from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from backend.schemas.chat import ChatRequest, ChatResponse
from backend.services.llm import get_llm_response, stream_llm_response
from backend.dependencies.auth import verify_api_key
from backend.utils.safety import safety_check
from backend.services.metrics import log_query
import json

from typing import AsyncGenerator, Union
import time

router = APIRouter()


@router.post("")
async def chat_endpoint(
    payload: ChatRequest,
    stream: bool = Query(False, description="Enable streaming mode"),
    _=Depends(verify_api_key)
):
    """
    Handles chat requests with optional streaming.

    - If stream=true → streams the response token-by-token using SSE.
    - Otherwise → returns the full response at once.
    """
    return await chat_handler(payload, stream)


# ----------------------------------------------------------
# 🔥 Extracted handler reusable by main.py /chat
# ----------------------------------------------------------
async def chat_handler(
    payload: ChatRequest,
    stream: bool = False
) -> Union[ChatResponse, StreamingResponse]:

    # Step 1: Safety check
    safety_check(payload.message)

    start_time = time.perf_counter()

    # ----------------------------------------------------------
    # STREAMING MODE
    # ----------------------------------------------------------
    if stream:

        async def event_generator() -> AsyncGenerator[bytes, None]:
            try:
                async for chunk in stream_llm_response(
                    conversation_id=payload.conversation_id,
                    user_message=payload.message
                ):
                    if not chunk or not chunk.strip():
                        continue
                    yield f"data: {json.dumps(chunk)}\n\n".encode("utf-8")

            except Exception as e:
                    yield f"data: {json.dumps('[ERROR] ' + str(e))}\n\n".encode("utf-8")
                    return  # ⛔ stop stream immediately

        
            yield b"data: [DONE]\n\n"

        latency_ms = (time.perf_counter() - start_time) * 1000
        log_query(latency_ms)

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    # ----------------------------------------------------------
    # NON-STREAMING MODE
    # ----------------------------------------------------------
    answer, sources = await get_llm_response(
        conversation_id=payload.conversation_id,
        user_message=payload.message
    )

    latency_ms = (time.perf_counter() - start_time) * 1000
    log_query(latency_ms)

    return ChatResponse(answer=answer, sources=sources)
