"""AI text transformation endpoint — inline proofreading, rewrites, expansions."""

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.services.ai_service import create_ai_service, GenerateContext, GenerateRequest

router = APIRouter(tags=["ai"])

SYSTEM_PROMPTS: dict[str, str] = {
    "fix_grammar": (
        "Correct spelling, grammar, and punctuation while preserving original tone. "
        "Return only the corrected text."
    ),
    "make_engaging": (
        "Rewrite this product copy to be punchy, compelling, and sales-focused. "
        "Return only the rewritten text."
    ),
    "shorten": (
        "Condense this text into a concise, high-impact version without losing key details. "
        "Return only the shortened text."
    ),
    "expand": (
        "Elaborate on this text, adding persuasive details and sensory descriptions. "
        "Return only the expanded text."
    ),
}


class AITransformRequest(BaseModel):
    text: str = Field(..., min_length=1)
    action: str = "fix_grammar"
    custom_prompt: str | None = None
    context: str | None = None


async def get_ai_service():
    return create_ai_service()


@router.post("/transform")
async def transform_text(
    payload: AITransformRequest,
    ai_service=Depends(get_ai_service),
):
    """Stream AI-transformed text via SSE."""

    system = payload.custom_prompt or SYSTEM_PROMPTS.get(
        payload.action,
        "Improve this text while preserving its original meaning. Return only the improved text.",
    )
    if payload.context:
        system += f"\n\nContext: {payload.context}"

    ai_req = GenerateRequest(
        type="transform",
        prompt=payload.text,
        context=GenerateContext(name=payload.context or ""),
    )

    async def sse_generator():
        try:
            async for chunk in ai_service.generate_stream(ai_req):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as err:
            yield f"event: error\ndata: {json.dumps({'detail': str(err)})}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
