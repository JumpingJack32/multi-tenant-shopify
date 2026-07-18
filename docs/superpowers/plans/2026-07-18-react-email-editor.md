# React Email Editor — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-18-react-email-editor.md`

---

## Phase 1 — Database & Data Model

### Step 1 — CampaignTemplate Model

**Files:** `src/orm/models/campaign.py` (new), `src/orm/models/__init__.py`

Model with fields: `name`, `subject`, `body_html`, `body_json`, `mailchimp_tag`, `is_active`, `send_at`, `send_recurrence`, `last_sent_at`. Register in `__init__.py`.

### Step 2 — Extend Segment Automation

**File:** `src/orm/models/segment.py`

Add `campaign_template_id: UUID | None = None` to `SavedSegment` model.

---

## Phase 2 — Backend API

### Step 3 — Template CRUD Endpoints

**File:** `src/routes/marketing/templates.py` (new), `src/main.py`

Five endpoints: `GET/POST /marketing/templates`, `GET/PUT/DELETE /marketing/templates/{id}`.

**Token sanitization on save:** Before persisting `body_html`, run a regex pass to strip inline HTML tags nested inside `{{ }}` tokens. Then validate the result with Jinja2's parser — if `jinja2.Environment().parse(html)` raises `TemplateSyntaxError`, return 400 with the error details.

```python
import re

def sanitize_tokens(html: str) -> str:
    """Strip formatting tags and entities accidentally wrapped around Jinja2 tokens."""
    def _clean(match):
        inner = match.group(1)
        inner = re.sub(r'</?(?:span|strong|em|b|i|u|font|style|p|br)[^>]*>', '', inner)
        inner = re.sub(r'&nbsp;', ' ', inner)
        return "{{ " + inner.strip() + " }}"
    return re.sub(r'\{\{([\s\S]*?)\}\}', _clean, html)
```

### Step 4 — Link Template to Segment

**File:** `src/routes/segments.py`

Extend `PUT /segments/{id}/automate` to accept and store `campaign_template_id`.

### Step 5 — Jinja2 Contextual Escaping

**File:** `src/services/email_service.py`

Add a `render_jinja_string()` function for subject lines. For `body_html`, use `|safe` filter on trusted blocks (`{{ offerHtml | safe }}`) rather than disabling auto-escaping globally.

---

## Phase 3 — Frontend Editor

### Step 6 — Editor Package + Page

**Files:** `apps/admin/src/app/(app)/marketing/templates/`

Install `@react-email/editor`. Create list page (`page.tsx`), editor page (`[id]/page.tsx`), hooks and API client.

- Dynamic import with `ssr: false` and `"use client"`
- `onChange` serializes both `body_json` (editor state) and `body_html` (rendered output)
- Token sidebar with click-to-insert buttons for `{{ customerName }}`, `{{ segmentName }}`, `{{ storeUrl }}`

---

## Phase 4 — Execution Engine

### Step 7 — Campaign Runner Integration

**File:** `src/services/campaign_runner.py`

In `_add_customer_tag()`, when `segment.campaign_template_id` is set, load the template, render via Jinja2, and route through the outbox event bus:

```python
async with outbox_context(db, event_bus) as publish:
    await publish("campaign.dispatch", "marketing", {
        "email": customer.email, "subject": subject, "html": html,
    }, tenant_id=segment.tenant_id)
```

### Step 8 — Schedule Worker

**File:** `src/services/campaign_runner.py` or new file

Background loop queries `campaign_templates WHERE send_at <= NOW() AND last_sent_at IS NULL AND is_active = true LIMIT 1 FOR UPDATE SKIP LOCKED`. Uses `SKIP LOCKED` so multiple worker instances don't block each other. Stamps `last_sent_at`, then triggers the send loop.

### Step 9 — Verify

```bash
doppler run -- uv run pytest tests/ -q     # 207+ passing
cd apps/admin && npx tsc --noEmit           # clean
cd packages/email && pnpm compile           # templates still compile
```
