# AI Content Generation — Specification (Final)

> **Status:** Draft  
> **Date:** 2026-07-20

---

## 1. Value

Add AI-assisted content generation for two key workflows:

- **Product descriptions** — Generate compelling product copy from name + keywords
- **Campaign templates** — Draft email body HTML with merge tags from topic + tone

Both use a backend adapter pattern so the provider (Ollama local / OpenRouter / OpenAI) can be swapped without touching UI code.

---

## 2. Architecture

```
[ Admin UI — AddProductForm / TemplateEditor ]
      │
      │  fetch("/api/v1/ai/generate", { headers: { Authorization: "Bearer " + token } })
      ▼
POST /api/v1/ai/generate ──> [ FastAPI Backend ]
      │                            │
      │                            ▼
      │                  [ AIService Adapter ]
      │                  (swappable via AI_PROVIDER)
      │               ┌─────────────────┬──────────────────┐
      │               │                  │                  │
      │          [ Ollama ]       [ OpenRouter ]      [ OpenAI ]
      │         (dev default)    (prod: ~$0.15/M)   (prod: ~$3/M)
      │               │                  │                  │
      │               └──────────────────┴──────────────────┘
      │                        Streaming via SSE
      ▼
[ Client accumulates stream, runs stripMarkdownFences()
  on completion, then inserts into editor ]
```

**Auth:** The admin frontend sends the Clerk JWT token via `Authorization: Bearer <token>`. FastAPI validates the token via existing Clerk middleware (same as all other admin routes). Direct browser fetch works because the JWT is in the request header.

---

## 3. API Contract

### `POST /api/v1/ai/generate`

**Request:**

```json
{
  "type": "product_description",
  "prompt": "Rucksack with laptop compartment, waterproof, grey",
  "context": {
    "name": "Urban Rucksack v2",
    "brand_voice": "Luxury streetwear",
    "tone": "technical",
    "tokens": ["{{ customerName }}", "{{ storeUrl }}"]
  }
}
```

**Response:** SSE stream with `data: <token>\n\n` lines. On error, sends `event: error\ndata: {"detail": "..."}\n\n`.

Client accumulates the full text, runs markdown fence cleanup on completion, then inserts into the editor — never renders raw streaming tokens into the WYSIWYG.

---

## 4. Backend — AIService

**File:** `services/backend-api/src/services/ai_service.py` (new)

### System Prompts

```python
DEFAULT_SYSTEM_PROMPTS = {
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
```

### Context Injection

Builds the system prompt dynamically from context:

```python
def build_system_prompt(type_: str, context: dict) -> str:
    base = DEFAULT_SYSTEM_PROMPTS.get(type_, "")
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
```

### Pydantic Models

```python
class GenerateContext(BaseModel):
    name: str | None = None
    brand_voice: str | None = None
    tone: str | None = None
    tokens: list[str] = Field(default_factory=list)

class GenerateRequest(BaseModel):
    type: str
    prompt: str
    context: GenerateContext | None = None
```

### Streaming

Unified OpenAI-compatible payload across all providers:

```python
async def generate_stream(self, req: GenerateRequest) -> AsyncGenerator[str, None]:
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

    # Explicit 60s timeout — LLMs can pause between tokens
    timeout = httpx.Timeout(60.0, connect=10.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", f"{self.base_url.rstrip('/')}/chat/completions", json=payload, headers=headers) as response:
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
```

### Output Sanitization

Generated HTML (campaign templates) must be sanitized before rendering to prevent XSS from prompt injection:

```python
import bleach

def sanitize_generated_html(html: str) -> str:
    allowed_tags = ["p", "h2", "h3", "strong", "em", "u", "ul", "ol", "li", "br", "a"]
    allowed_attrs = {"a": ["href"]}
    cleaned = clean_markdown_fences(html)
    return bleach.clean(cleaned, tags=allowed_tags, attributes=allowed_attrs, strip=True)
```

Product descriptions are plain text (not HTML), so they skip the bleach step.

### Markdown Fence Cleanup

````python
def clean_markdown_fences(text: str) -> str:
    cleaned = re.sub(r"^```(?:html)?\s*", "", text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()
````

### Provider Config

```python
def create_ai_service() -> AIService:
    provider = settings.ai_provider or "ollama"
    config = {
        "ollama": {"base_url": "http://localhost:11434/v1", "model": "qwen2.5:7b"},
        "openrouter": {"base_url": "https://openrouter.ai/api/v1", "model": "meta-llama/llama-3.1-8b-instruct"},
        "openai": {"base_url": "https://api.openai.com/v1", "model": "gpt-4o-mini"},
    }
    # All share OpenAI-compatible /chat/completions path — base_url already ends with /v1
    cfg = config.get(provider, config["ollama"])
    return AIService(provider=provider, api_key=getattr(settings, f"{provider}_api_key", ""), **cfg)
```

---

## 5. Backend — Route

**File:** `services/backend-api/src/routes/ai.py` (new)

```python
import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from src.services.ai_service import AIService, GenerateRequest, create_ai_service

router = APIRouter(tags=["ai"])

async def get_ai_service():
    return create_ai_service()


@router.post("/generate")
async def generate_ai_content(
    payload: GenerateRequest,
    ai_service: AIService = Depends(get_ai_service),
):
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
```

Mounted at `/api/v1/ai` in `main.py`:

```python
app.include_router(ai_router, prefix="/api/v1/ai")
```

Auth is handled by the existing Clerk JWT middleware applied to all `/api/v1/*` routes.

---

## 6. Frontend — Client Integration

The existing `apps/admin/src/app/api/generate/route.ts` Next.js route is deprecated. The admin frontend calls FastAPI directly with the Clerk JWT:

````typescript
async function generateWithAI(
  type: string,
  prompt: string,
  context?: Record<string, unknown>,
) {
  const res = await fetch("/api/v1/ai/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Clerk JWT is forwarded automatically via existing fetch wrapper
    },
    body: JSON.stringify({ type, prompt, context }),
  });

  if (!res.ok) throw new Error("AI generation failed");

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  let isDone = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");

    // Keep incomplete line trailing in the buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const content = line.slice(6);
        if (content === "[DONE]") {
          isDone = true;
          break;
        }
        fullText += content; // Preserve spaces and newlines
      } else if (line.startsWith("event: error")) {
        throw new Error("AI generation error on server");
      }
    }
    if (isDone) break; // Exits outer reader loop
  }

  // Strip markdown fences on full response
  return fullText
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}
````

### Wire points

| Use case            | Location                                           | Trigger                                                               |
| ------------------- | -------------------------------------------------- | --------------------------------------------------------------------- |
| Product description | `add-product-form.tsx` — "Generate" button         | Collects name + keywords as prompt, inserts into description textarea |
| Campaign template   | `templates/[id]/page.tsx` — "Draft with AI" button | Collects subject + available tokens, inserts HTML into editor         |

---

## 7. Provider Configuration

```bash
# Dev: works out of the box with Ollama (no config needed)
doppler secrets set AI_PROVIDER=openrouter
doppler secrets set OPENROUTER_API_KEY=sk-or-v1-...
```

| Provider          | Env `AI_PROVIDER` | API Key Secret       | Model                              |
| ----------------- | ----------------- | -------------------- | ---------------------------------- |
| Ollama (dev)      | `ollama`          | none                 | `qwen2.5:7b`                       |
| OpenRouter (prod) | `openrouter`      | `OPENROUTER_API_KEY` | `meta-llama/llama-3.1-8b-instruct` |
| OpenAI            | `openai`          | `OPENAI_API_KEY`     | `gpt-4o-mini`                      |

---

## 8. Risks & Mitigations

| Risk                                             | Mitigation                                                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Brand voice mismatch for non-streetwear products | `brand_voice` field in context defaults to neutral e-commerce copywriter if omitted                |
| Raw markdown fences visible during streaming     | Client accumulates stream, never renders partial tokens into editor — cleans on completion         |
| Proxy drops idle SSE connection                  | `X-Accel-Buffering: no` header + `keep-alive` connection headers                                   |
| Cold-start latency on Ollama                     | First request loads model into memory (~5-10s delay); subsequent requests are fast                 |
| Auth bypass via direct fetch                     | Clerk JWT middleware on FastAPI validates all `/api/v1/*` requests — same as existing admin routes |
| Cost overruns                                    | Monthly spend cap in OpenRouter dashboard                                                          |
| Prompt injection → malicious HTML in templates   | `bleach` sanitizer strips dangerous tags/attrs from generated HTML before editor insertion         |
| Client SSE stream hangs on partial network reads | Line buffering + `[DONE]` sentinel + `done: true` from reader.close() — triple guard               |

---

## 9. Files Changed

| File                                                                | Change                                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `services/backend-api/src/services/ai_service.py`                   | **New** — provider adapter, system prompt builder, streaming, fence cleanup |
| `services/backend-api/src/routes/ai.py`                             | **New** — SSE streaming endpoint with heartbeat headers                     |
| `services/backend-api/src/main.py`                                  | Register `ai_router` at `/api/v1/ai`                                        |
| `services/backend-api/src/config.py`                                | Add `ai_provider`, `openrouter_api_key`, `openai_api_key`                   |
| `services/backend-api/pyproject.toml`                               | Add `bleach` dependency for HTML sanitization                               |
| `apps/admin/src/app/api/generate/route.ts`                          | Deprecate — can be removed                                                  |
| `apps/admin/src/app/(app)/products/components/add-product-form.tsx` | Add "Generate" description button                                           |
| `apps/admin/src/app/(app)/marketing/templates/[id]/page.tsx`        | Add "Draft with AI" button                                                  |
