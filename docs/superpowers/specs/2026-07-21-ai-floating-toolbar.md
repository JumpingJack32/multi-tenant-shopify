# AI Floating Selection Toolbar — Specification

> **Status:** Draft

---

## 1. Value

Provide an inline "Transform with AI" floating toolbar that appears when users select text inside textareas (product descriptions, campaign templates). Actions like _Fix Grammar_, _Make Engaging_, _Shorten_, and _Expand_ stream AI-generated replacements directly into the text without leaving the editor.

---

## 2. Architecture

```
User selects text in <textarea>
       │
       ▼
Floating Toolbar appears above selection (fixed positioning)
       │
       ▼
User clicks action ("Fix Grammar", "Make Engaging", etc.)
       │
       ▼
POST /api/v1/ai/transform (SSE stream)
       │
       ▼
Streamed text replaces selection via execCommand("insertText")
```

---

## 3. Backend: `POST /api/v1/ai/transform`

### Request

```json
{
  "text": "Selected text to transform",
  "action": "fix_grammar",
  "custom_prompt": "Optional extra instructions",
  "context": "Product description for Urban Rucksack"
}
```

### Actions

| Action          | System Prompt                                                              |
| --------------- | -------------------------------------------------------------------------- |
| `fix_grammar`   | Correct spelling, grammar, and punctuation while preserving original tone. |
| `make_engaging` | Rewrite to be punchy, compelling, and sales-focused.                       |
| `shorten`       | Condense into concise, high-impact version.                                |
| `expand`        | Elaborate with persuasive details.                                         |

### Response

SSE stream via `text/event-stream` with `data: <chunk>\n\n` and `data: [DONE]\n\n`. Falls back to existing `AIService` adapter (Ollama/OpenRouter/OpenAI).

---

## 4. Frontend: `<AIToolbar />`

### Selection Detection

- Listens to `selectionchange` event on `document`
- Captures `getBoundingClientRect()` from `Range` → positions toolbar above selection
- Clears toolbar on collapsed/empty selection

### Focus Preservation

- `onMouseDown={(e) => e.preventDefault()}` on all toolbar buttons prevents `blur` on the textarea, keeping the selection alive

### Text Replacement

- Accumulates full SSE stream into a buffer, then replaces the original selection in one atomic operation via `textarea.setSelectionRange(start, end)` + `execCommand("insertText", false, buffer)`
- Chunk 1: replaces the selected text. Subsequent chunks append at cursor. On stream complete, the full result is in place with a single undo step (`Ctrl+Z` reverts the entire transformation, not per-chunk)

### Viewport Boundary

- Toolbar appears above the selection. If `selectionRect.top < 48px` (too close to viewport top), render below the selection instead

### Integration Points

| Page                 | Field                |
| -------------------- | -------------------- |
| `/products?view=add` | Description textarea |

---

## 5. Files Changed

| File                                                                | Change                                      |
| ------------------------------------------------------------------- | ------------------------------------------- |
| `services/backend-api/src/routes/ai_transform.py`                   | **New** — `/api/v1/ai/transform` endpoint   |
| `services/backend-api/src/main.py`                                  | Register `ai_transform_router`              |
| `apps/admin/src/components/ui/ai-toolbar.tsx`                       | **New** — floating toolbar component        |
| `apps/admin/src/app/(app)/products/components/add-product-form.tsx` | Mount `<AIToolbar />`, wire `onReplaceText` |
