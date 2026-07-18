# React Email Editor — Tenant Campaign Templates

> **Status:** Draft  
> **Prerequisites:** React Email compile pipeline (shipped), `render_email_template()` + Jinja2 (shipped), `CampaignRunner` (shipped)

---

## 1. Architecture

The editor lets tenants visually design email templates that are stored in the database, rendered at send time by Jinja2, and delivered via the existing `send_raw()` pipeline.

```
Editor (React) → Save → DB (campaign_templates table)
                              │
                   CampaignRunner triggers send
                              │
                   render_email_template(name, context)
                              │
                   send_raw() → Resend API
```

**Two-tier split (from prior spec):**

- **Transactional templates** — remain as compiled React Email files (engineer-managed)
- **Campaign templates** — stored in DB, editable in the browser, rendered by Jinja2

---

## 2. Data Model

**File:** `src/orm/models/campaign.py`

```python
class CampaignTemplate(BaseModel, table=True):
    __tablename__ = "campaign_templates"
    name: str = Field(max_length=255)
    subject: str = Field(max_length=255)        # Jinja2-rendered, e.g. "Sale ends {{ date }}"
    body_html: str = Field(sa_column=Column(Text))  # Jinja2 template with auto-escaping
    body_json: str | None = Field(default=None, sa_column=Column(Text))  # Editor state (re-edit support)
    mailchimp_tag: str | None = None
    is_active: bool = Field(default=False)
    send_at: datetime | None = None
    send_recurrence: str | None = None          # "weekly", "monthly"
    last_sent_at: datetime | None = None
```

---

## 3. React Email Editor Integration

**File:** `apps/admin/src/app/(app)/marketing/templates/[id]/page.tsx` (new)

The `@react-email/editor` package provides a visual drag-and-drop editor that outputs HTML. The workflow:

1. Admin creates a new campaign template with a name and subject line
2. Admin opens the visual editor — a full-screen page at `/marketing/templates/{id}/edit`
3. The editor outputs HTML which is saved to `CampaignTemplate.body_html`
4. Admin can insert Jinja2 tokens (`{{ customerName }}`, `{{ segmentName }}`) via a sidebar panel
5. When saved, the template is available for the `CampaignRunner` to use

**SSR safety:** The editor relies on browser APIs (`document`, `window`). Import dynamically with `ssr: false`:

```tsx
"use client";

import dynamic from "next/dynamic";

const EmailEditor = dynamic(
  () => import("@react-email/editor").then((mod) => mod.Editor),
  { ssr: false },
);

export default function TemplateEditor({ templateId }: { templateId: string }) {
  const { data, save } = useCampaignTemplate(templateId);

  return (
    <div className="h-full flex flex-col">
      <Toolbar onSave={() => save()} />
      <EmailEditor
        value={data.body_html}
        onChange={(html) => updateBody(html)}
        height="calc(100vh - 120px)"
      />
    </div>
  );
}
```

---

## 4. Template Token System

A sidebar panel lists available Jinja2 tokens that admins can insert:

| Token                  | Source                 | Example Value                |
| ---------------------- | ---------------------- | ---------------------------- |
| `{{ customerName }}`   | Customer               | "John"                       |
| `{{ segmentName }}`    | SavedSegment           | "VIP"                        |
| `{{ offerHtml }}`      | Rendered by backend    | Promotional HTML block       |
| `{{ storeUrl }}`       | Tenant settings        | "https://store.example.com"  |
| `{{ unsubscribeUrl }}` | Generated per-customer | HMAC-signed unsubscribe link |

Tokens are inserted as text into the editor's HTML content. When the template is rendered, Jinja2 evaluates them with auto-escaping.

---

## 5. Backend: Campaign Template CRUD

**File:** `src/routes/marketing/templates.py`

| Method   | Endpoint                    | Description            |
| -------- | --------------------------- | ---------------------- |
| `GET`    | `/marketing/templates`      | List templates         |
| `POST`   | `/marketing/templates`      | Create template        |
| `GET`    | `/marketing/templates/{id}` | Get template with body |
| `PUT`    | `/marketing/templates/{id}` | Update template        |
| `DELETE` | `/marketing/templates/{id}` | Delete template        |

---

## 6. Link Template to Segment

Extend the existing `PUT /segments/{id}/automate` to accept an optional `campaign_template_id`. When set, the `CampaignRunner` sends the template instead of the generic campaign-promo:

```python
# In CampaignRunner._add_customer_tag():
if segment.campaign_template_id:
    tmpl = await db.get(CampaignTemplate, segment.campaign_template_id)
    if tmpl:
        html = render_email_template_from_db(tmpl.body_html, customer_name=customer.first_name, ...)
        subject = render_jinja_string(tmpl.subject, customer_name=customer.first_name, ...)

        # Route through the outbox event bus — never fire unmanaged tasks
        async with outbox_context(db, event_bus) as publish:
            await publish("campaign.dispatch", "marketing", {
                "email": customer.email,
                "subject": subject,
                "html": html,
            }, tenant_id=segment.tenant_id)
```

---

## 7. Schedule Tab

**File:** `apps/admin/src/app/(app)/marketing/templates/[id]/page.tsx`

A "Schedule" tab alongside the editor allows:

- Immediate send (fires event for all current segment members)
- Scheduled send at a specific date/time
- Recurring sends (weekly, monthly)

A background worker checks every minute for templates where `send_at <= NOW() AND last_sent_at IS NULL` and triggers the send.

---

## 8. Files Changed

| File                                            | Change                                         |
| ----------------------------------------------- | ---------------------------------------------- |
| `src/orm/models/campaign.py`                    | **New** — `CampaignTemplate` model             |
| `src/orm/models/__init__.py`                    | Export new model                               |
| `src/routes/marketing/templates.py`             | **New** — template CRUD                        |
| `src/routes/segments.py`                        | Link `campaign_template_id` to automation      |
| `src/services/campaign_runner.py`               | Send DB template when linked                   |
| `src/services/email_service.py`                 | Add `render_jinja_string()` for subject lines  |
| `apps/admin/src/app/(app)/marketing/templates/` | **New** — list page, editor page, schedule tab |
| `apps/admin/src/features/marketing/`            | **New** — hooks, API client for templates      |

---

## 9. Risks

| Risk                                        | Impact                                                                              | Mitigation                                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Token corruption via WYSIWYG**            | High — editor inserts invisible HTML inside `{{ tokens }}`, breaking Jinja2 parsing | Validate template on save: extract `{{ ... }}` tokens and verify they remain un-nested. Reject save with a clear error pointing to the corrupted field. |
| **Double-escaping breaks layouts**          | High — `autoescape=True` escapes `{{ offerHtml }}` into literal `&lt;div&gt;` text  | Use `autoescape=False` for fields rendered via `                                                                                                        | safe` filter in the template. Store known-safe HTML blocks separately from user text fields. |
| **Unbounded JSON state mutation**           | Medium — saving only `body_html` loses editor state; re-opening degrades layouts    | Store both `body_json` (editor internal state) and `body_html` (rendered output). `body_json` enables lossless re-editing.                              |
| **Ghost processing via unmanaged tasks**    | High — `asyncio.ensure_future` drops tasks if context recycles                      | Route all sends through the outbox event bus (`event_bus.publish()` + `flush()`). Never fire unmanaged tasks.                                           |
| **Next.js SSR incompatibility**             | Medium — `@react-email/editor` uses `document` API, crashes during SSR              | Dynamic import with `ssr: false` and `"use client"` directive.                                                                                          |
| **Scheduled templates fire multiple times** | Medium — worker races on `send_at` boundary                                         | `last_sent_at` guard with `send_at <= NOW() AND last_sent_at IS NULL` in the query. Atomic update on send.                                              |
