# AI Content Generation — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-20-ai-content-generation.md`

---

## Step 1 — Backend: AIService

### 1a — Install `bleach`

```bash
cd services/backend-api && uv add bleach
```

### 1b — Create `services/backend-api/src/services/ai_service.py`

- Pydantic models: `GenerateContext`, `GenerateRequest`
- `DEFAULT_SYSTEM_PROMPTS` dict for `product_description` and `campaign_template`
- `build_system_prompt(type_, context_dict)` with dynamic brand_voice/tone/tokens injection
- `AIService` class with `generate_stream(req)`:
  - `httpx.Timeout(60.0, connect=10.0)` for slow LLMs
  - Yields raw content tokens (not SSE-wrapped)
  - Parses OpenAI-compatible `delta.content` from stream
- `sanitize_generated_html(html)` — `bleach.clean()` with safe tag whitelist
- `clean_markdown_fences(text)` — strips ```html fences
- `create_ai_service()` factory reading `settings.ai_provider`

### 1c — Add config fields

**File:** `services/backend-api/src/config.py`

```python
ai_provider: str = "ollama"
openrouter_api_key: str | None = None
openai_api_key: str | None = None
```

---

## Step 2 — Backend: Route

### 2a — Create `services/backend-api/src/routes/ai.py`

- `POST /generate` with `StreamingResponse` + SSE generator
- Emits `data: {token}\n\n` per chunk, `data: [DONE]\n\n` on completion
- Sends `event: error` on exception
- Headers: `X-Accel-Buffering: no`, `Cache-Control: no-cache`

### 2b — Register in `main.py`

```python
from src.routes.ai import router as ai_router
app.include_router(ai_router, prefix="/api/v1/ai")
```

---

## Step 3 — Frontend: API Client + UI Buttons

### 3a — Create `generateWithAI()` helper (or add to existing API client)

- SSE stream reader with line buffering, `[DONE]` sentinel, markdown fence cleanup
- Calls `POST /api/v1/ai/generate` directly (Clerk JWT via existing auth)

### 3b — Wire "Generate" button in product form

**File:** `apps/admin/src/app/(app)/products/components/add-product-form.tsx`

- Button next to description label
- Collects `name` + `prompt` from form state
- Inserts completion into description textarea

### 3c — Wire "Draft with AI" button in template editor

**File:** `apps/admin/src/app/(app)/marketing/templates/[id]/page.tsx`

- Button next to template editor
- Collects subject + available tokens as context
- Inserts sanitized HTML into Unlayer editor via `onSave` callback

---

## Step 4 — Verify

```bash
cd services/backend-api && PYTHONPATH=. doppler run -- uv run pytest -q
pnpm --filter admin exec tsc --noEmit
pnpm --filter admin exec eslint .
pnpm vitest run --project admin
```
