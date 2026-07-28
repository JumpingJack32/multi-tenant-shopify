# Core Admin Settings — Implementation Plan

**Spec:** General Store Details, Shipping, Taxes

---

## Step 1 — Settings API Endpoint

**File:** `src/routes/admin_settings.py`

- `GET /admin/settings` — returns tenant settings JSON + tax config + shipping methods
- `PUT /admin/settings` — updates tenant.settings JSON (store name, currency, timezone, etc.)

Tax and shipping configs already have their own endpoints (GET/PUT `/settings/taxes`, CRUD `/admin/shipping-methods`).

## Step 2 — General Store Details Page

**File:** `apps/admin/src/app/(app)/settings/general/page.tsx` (new)

- Store name, support email, phone, domain
- Currency selector, timezone, unit system
- Reads/writes via `GET/PUT /admin/settings`

## Step 3 — Shipping & Tax pages (already built in Phase 1)

Shipping and tax settings pages were completed in the tax/shipping phase earlier. Verify they're functional.

## Step 4 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
