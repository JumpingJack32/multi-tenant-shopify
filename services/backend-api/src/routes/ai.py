"""AI content generation route — SSE streaming endpoint."""

import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from src.services.ai_service import AIService, create_ai_service, GenerateRequest

router = APIRouter(tags=["ai"])


async def get_ai_service() -> AIService:
    return create_ai_service()


@router.post("/generate")
async def generate_ai_content(
    payload: GenerateRequest,
    ai_service: AIService = Depends(get_ai_service),
):
    """Stream AI-generated content via SSE. Supports product descriptions and campaign templates."""

    async def sse_generator():
        try:
            async for chunk in ai_service.generate_stream(payload):
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
