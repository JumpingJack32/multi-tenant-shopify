# AI Floating Selection Toolbar — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-21-ai-floating-toolbar.md`

---

## Step 1 — Backend: `/api/v1/ai/transform`

### File: `services/backend-api/src/routes/ai_transform.py` (new)

- `AITransformRequest` Pydantic model with `text`, `action`, `custom_prompt`, `context`
- `SYSTEM_PROMPTS` dict mapping actions to system prompts
- `POST /transform` — SSE streaming, reuses `AIService.generate_stream()`
- Auth via existing Clerk middleware on `/api/v1/*`

### File: `services/backend-api/src/main.py`

Register `ai_transform_router` at `/api/v1/ai`.

---

## Step 2 — Frontend: `<AIToolbar />`

### File: `apps/admin/src/components/ui/ai-toolbar.tsx` (new)

- `selectionchange` listener → captures `getBoundingClientRect()` → positions toolbar
- Viewport clamp: if `top < 48px`, render below selection instead of above
- `onMouseDown={(e) => e.preventDefault()}` preserves textarea focus
- Accumulates SSE buffer, replaces selection via `setSelectionRange()` + `execCommand("insertText")`

### File: `apps/admin/src/app/(app)/products/components/add-product-form.tsx`

- Import and mount `<AIToolbar onReplaceText={(newText) => setDescription(newText)} />`
- Pass description `textarea` ref for selection tracking

---

## Step 3 — Verify

```bash
cd services/backend-api && PYTHONPATH=. doppler run -- uv run pytest -q
pnpm --filter admin exec tsc --noEmit
pnpm --filter admin exec eslint .
pnpm vitest run --project admin
```
