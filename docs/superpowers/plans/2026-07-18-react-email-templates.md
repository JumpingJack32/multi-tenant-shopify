# React Email Templates — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-18-react-email-templates.md`

---

## Step 1 — Create Email Package

**Files:** `packages/email/` (new)

Package with `package.json`, `tsconfig.json`, React Email dependencies. Add compile script using `render()` from `@react-email/components`.

## Step 2 — Write Templates

**Files:** `packages/email/src/templates/*.tsx`

3 transactional templates: `order-confirm`, `shipment-tracking`, `store-credit-notification`. Each uses `dangerouslySetInnerHTML` for Jinja2 token blocks and passes through `{{ ... }}` tokens as literal props.

## Step 3 — Compile Templates

**File:** `packages/email/scripts/compile.ts`

Run `render()` per template, write `.html` files to `services/backend-api/email-templates/`. Jinja2 tokens survive as verbatim text.

## Step 4 — Add Jinja2 + send_raw to Backend

**File:** `src/services/email_service.py`

Add Jinja2 `Environment` with `FileSystemLoader` and autoescaping. Add `send_raw()` method to `ResendEmailService`.

## Step 5 — Wire Triggers

**Files:** `src/services/campaign_runner.py`, `src/routes/customers.py`, `src/services/fulfillment_service.py`

- Campaign runner: fire-and-forget `send_raw()` on segment enter
- Store credit endpoint: send notification on positive amount
- Fulfillment tracking: send shipment notification on TRANSIT

## Step 6 — Verify

```bash
cd packages/email && npx tsx scripts/compile.ts    # generates HTML
cd services/backend-api && doppler run -- uv run pytest tests/ -q  # 207+ passing
```
