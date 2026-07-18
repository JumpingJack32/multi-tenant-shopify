# React Email Templates — Specification

> **Status:** Draft  
> **Prerequisites:** `ResendEmailService` (existing), `CampaignRunner` (existing)

---

## 1. Two-Tier Architecture

| Tier                     | Type                                  | Managed by       | Engine                               | Editor                         |
| ------------------------ | ------------------------------------- | ---------------- | ------------------------------------ | ------------------------------ |
| **Transactional**        | Order confirm, shipment, store credit | Engineers        | React Email → `render()` → flat HTML | Static code                    |
| **Campaign / Marketing** | Segment-triggered promos              | Tenants (future) | Jinja2 templates rendered at runtime | `@react-email/editor` (future) |

Transactional emails are compiled at build time via `@react-email/components` and stored as flat HTML. Marketing emails are Jinja2 templates stored in the database, rendered at send time with auto-escaping. This keeps the engineering path simple while leaving the visual editor path open.

---

## 2. Package Structure

```
packages/email/
  ├── package.json
  ├── tsconfig.json
  ├── scripts/
  │   └── compile.ts          ← Build script: render() → flat HTML
  └── src/
      ├── templates/
      │   ├── order-confirm.tsx
      │   ├── shipment-tracking.tsx
      │   └── store-credit-notification.tsx
      └── components/
          ├── layout.tsx       ← Shared wrapper
          └── button.tsx       ← CTA component
```

Marketing templates live in the database (not this package) — they are Jinja2 strings managed by tenants.

---

## 3. Build Pipeline: `render()` Not CLI

**File:** `packages/email/scripts/compile.ts`

```typescript
import { render } from "@react-email/components";
import fs from "fs";
import path from "path";
import OrderConfirm from "../src/templates/order-confirm";

const templates = [
  {
    name: "order-confirm",
    Component: OrderConfirm,
    props: {
      customerName: "{{ customerName }}",
      orderNumber: "{{ orderNumber }}",
      items: "{{ items }}",
      total: "{{ total }}",
      storeUrl: "{{ storeUrl }}",
    },
  },
  // shipment-tracking, store-credit-notification ...
];

const outDir = path.join(
  __dirname,
  "../../../services/backend-api/email-templates",
);
fs.mkdirSync(outDir, { recursive: true });

for (const { name, Component, props } of templates) {
  const html = render(Component(props));
  fs.writeFileSync(path.join(outDir, `${name}.html`), html);
}
```

Notable: The `{{ ... }}` tokens survive the `render()` call because React Email does not evaluate template syntax — it only renders React components to HTML. The tokens pass through as literal text and are replaced by Jinja2 at send time.

**Do NOT use `react-email build` CLI** — it builds a Next.js preview app, not standalone HTML files.

---

## 4. Backend: Jinja2 Rendering (Not `str.replace()`)

**File:** `src/services/email_service.py`

```python
from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_DIR = Path(__file__).parent.parent / "email-templates"
env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html"]),
)

def render_template(name: str, **context) -> str:
    return env.get_template(f"{name}.html").render(**context)
```

Jinja2 auto-escapes all interpolated values — malicious HTML in customer names is neutralized. No `str.replace()`.

---

## 5. Templates

### 5.1 Order Confirmation

```tsx
interface Props {
  customerName: string;
  orderNumber: string;
  itemsToken: string; // Jinja2 loop — passed through dangerouslySetInnerHTML
  total: string;
  storeUrl: string;
}

export default function OrderConfirm({
  customerName,
  orderNumber,
  itemsToken,
  total,
  storeUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "sans-serif", padding: 24 }}>
        <Container>
          <Text>Hi {customerName},</Text>
          <Text>Your order {orderNumber} is confirmed.</Text>
          <table dangerouslySetInnerHTML={{ __html: itemsToken }} />
          <Text>
            <strong>Total: {total}</strong>
          </Text>
          <Button href={`${storeUrl}/orders/${orderNumber}`}>View Order</Button>
        </Container>
      </Body>
    </Html>
  );
}
```

**Compile script passes the Jinja2 token verbatim:**

```typescript
props: {
  itemsToken: `{% for item in items %}<tr><td>{{ item.qty }}x {{ item.name }}</td><td>{{ item.price }}</td></tr>{% endfor %}`;
}
```

File: `packages/email/src/templates/order-confirm.tsx`

### 5.2 Shipment Tracking

Triggered by `FulfillmentService.update_tracking()` when status becomes `TRANSIT`.

### 5.3 Store Credit Notification

Triggered by `POST /customers/{id}/credit` with a positive amount.

---

## 6. Campaign Runner: Async Safe

The campaign runner already runs in an `asyncio.create_task()` outside any request cycle. Adding `await email_service.send_raw()` inside `_add_customer_tag()` is safe — it does not block a request handler. The DB transaction is already committed before the email call:

```python
async def _add_customer_tag(self, db, config, customer_id, segment):
    async with AsyncSession(self.engine) as email_session:
        customer = ...
        await sync_contact(...)
        db.add(CustomerSegmentMembership(...))

    # Email is sent as a fire-and-forget task — DB transaction already committed
    if customer.email:
        html = render_template("campaign-promo", customer_name=customer.first_name)
        svc = create_email_service()
        asyncio.ensure_future(svc.send_raw(
            customer.email, f"Welcome to {segment.name}", html
        ))
```

**Why fire-and-forget:** The campaign runner processes segments sequentially. If email sending awaited each call, 1,000 customers × 500ms Resend latency = 8+ minutes of wall-clock time per segment. Fire-and-forget allows the loop to advance immediately while sends complete in the background. The runner's `try/except` at the segment level catches any send failures without blocking the next customer.

---

## 7. ResendEmailService Extension

**File:** `src/services/email_service.py`

```python
async def send_raw(self, to_email: str, subject: str, html: str) -> bool:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(...)
    return response.status_code < 400
```

---

## 8. Future: Campaign Templates in DB + Editor

When `@react-email/editor` is introduced:

- Marketing templates move from files to a `campaign_templates` table with `subject`, `body_html` (Jinja2), and `mailchimp_tag` fields
- The editor outputs Jinja2-compatible HTML that the existing `render_template()` function can process
- Transactional templates stay as compiled files

This two-tier design means the transactional path never changes, and the marketing path swaps its template source from files to DB without touching the send pipeline.

---

## 9. Files Changed

| File                                  | Change                                           |
| ------------------------------------- | ------------------------------------------------ |
| `packages/email/`                     | **New** — React Email package                    |
| `packages/email/scripts/compile.ts`   | **New** — `render()` build script                |
| `src/services/email_service.py`       | Add `send_raw()`, add Jinja2 `render_template()` |
| `src/services/campaign_runner.py`     | Add email step in `_add_customer_tag()`          |
| `src/routes/customers.py`             | Trigger email on store credit add                |
| `src/services/fulfillment_service.py` | Trigger email on tracking update                 |
| `requirements.txt` / `pyproject.toml` | Add `jinja2` dependency                          |

---

## 10. Risks

| Risk                                                                              | Mitigation                                                                                                                                  |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| React Email `render()` outputs React props as stringified JSON in the HTML        | Templates must use `{{ items }}` as a JSON placeholder and render with Jinja2 loops; or use `dangerouslySetInnerHTML` for the dynamic parts |
| Build-time templates break at runtime if Jinja2 tokens are escaped by React Email | Test with `render()` output before committing — React Email passes unknown text through verbatim                                            |
| Marketing templates stored in DB without editor are hard to author                | Start with file-based marketing templates and migrate to DB when the editor lands                                                           |
