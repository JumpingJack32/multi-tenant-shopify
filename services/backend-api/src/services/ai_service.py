"""AI content generation service with pluggable provider adapter.

Supports Ollama (local), OpenRouter, and OpenAI via OpenAI-compatible /v1 API.
All HTTP calls use httpx with explicit 60s timeouts for LLM latency."""

import json
import re
from typing import AsyncGenerator

import bleach
import httpx
from pydantic import BaseModel, Field


class GenerateContext(BaseModel):
    name: str | None = None
    brand_voice: str | None = None
    tone: str | None = None
    tokens: list[str] = Field(default_factory=list)


class GenerateRequest(BaseModel):
    type: str
    prompt: str
    context: GenerateContext | None = None


DEFAULT_SYSTEM_PROMPTS: dict[str, str] = {
    "product_description": (
        "You are an expert e-commerce copywriter. Write concise, compelling product "
        "descriptions based on the provided details. Focus on key features, materials, "
        "and benefits. Keep it under 3 paragraphs."
    ),
    "campaign_template": (
        "You are an email marketing copywriter. Generate clean HTML email body content "
        "using the allowed Jinja2 merge tags. Use semantic HTML elements "
        "(<p>, <h2>, <strong>, <ul>). Do not include <html> or <body> tags."
    ),
}

ALLOWED_HTML_TAGS = ["p", "h2", "h3", "strong", "em", "u", "ul", "ol", "li", "br", "a"]
ALLOWED_HTML_ATTRS = {"a": ["href"]}


def build_system_prompt(type_: str, context: dict) -> str:
    """Build system prompt with dynamic context injection."""
    base = DEFAULT_SYSTEM_PROMPTS.get(type_, DEFAULT_SYSTEM_PROMPTS["product_description"])
    modifiers = []

    if context.get("brand_voice"):
        modifiers.append(f"Brand Voice: {context['brand_voice']}")
    if context.get("tone"):
        modifiers.append(f"Tone: {context['tone']}")
    if context.get("name"):
        modifiers.append(f"Subject: {context['name']}")
    if context.get("tokens"):
        tokens_str = ", ".join(context["tokens"])
        modifiers.append(
            f"STRICT REQUIREMENT: You MUST only use these exact merge tags: {tokens_str}"
        )

    return f"{base}\n\n" + "\n".join(modifiers) if modifiers else base


def clean_markdown_fences(text: str) -> str:
    """Remove markdown code fences that LLMs often wrap HTML output in."""
    cleaned = re.sub(r"^```(?:html)?\s*", "", text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def sanitize_generated_html(html: str) -> str:
    """Sanitize LLM-generated HTML — strip dangerous tags/attrs, keep merge tags."""
    cleaned = clean_markdown_fences(html)
    return bleach.clean(cleaned, tags=ALLOWED_HTML_TAGS, attributes=ALLOWED_HTML_ATTRS, strip=True)


class AIService:
    """AI provider adapter — streams tokens from any OpenAI-compatible endpoint."""

    def __init__(self, provider: str, base_url: str, model: str, api_key: str = ""):
        self.provider = provider
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key = api_key

    async def generate_stream(self, req: GenerateRequest) -> AsyncGenerator[str, None]:
        """Stream content tokens from the AI provider. Yields raw text strings."""
        context_dict = req.context.model_dump() if req.context else {}
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": build_system_prompt(req.type, context_dict)},
                {"role": "user", "content": req.prompt},
            ],
            "stream": True,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}

        timeout = httpx.Timeout(60.0, connect=10.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                json=payload,
                headers=headers,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            content = data["choices"][0]["delta"].get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue


def create_ai_service() -> AIService:
    """Factory — reads settings.ai_provider and returns configured AIService."""
    from src.config import settings

    provider = settings.ai_provider or "ollama"
    configs = {
        "ollama": {"base_url": "http://localhost:11434/v1", "model": "qwen2.5:7b"},
        "openrouter": {
            "base_url": "https://openrouter.ai/api/v1",
            "model": "meta-llama/llama-3.1-8b-instruct",
        },
        "openai": {"base_url": "https://api.openai.com/v1", "model": "gpt-4o-mini"},
    }
    cfg = configs.get(provider, configs["ollama"])
    api_key = ""
    if provider == "openrouter" and settings.openrouter_api_key:
        api_key = settings.openrouter_api_key
    elif provider == "openai" and settings.openai_api_key:
        api_key = settings.openai_api_key
    return AIService(provider=provider, api_key=api_key, **cfg)
