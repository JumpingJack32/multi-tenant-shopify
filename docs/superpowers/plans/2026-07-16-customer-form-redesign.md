# Customer Form Redesign — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-16-customer-form-redesign.md`

---

## Step 1 — Backend: Extend Customer Model

**Files:** `src/orm/models/order.py`

Add to `Customer`: `language`, `email_marketing_consent`, `sms_marketing_consent`, `tax_exempt`, `tax_exempt_reason`.
Add to `CustomerAddress`: `company`, `phone`.

## Step 2 — Backend: Update Schemas

**Files:** `src/orm/schemas/customer.py`

Extend `CustomerCreate` with all new fields + address sub-fields (`address_line1`, `address_city`, etc. + `address_phone`). Make `email` optional. Keep `CustomerResponse` extended with new read-only fields.

## Step 3 — Backend: Update POST /customers/ Route

**Files:** `src/routes/customers.py`

Rewrite to: validate `email or phone` required, create `Customer`, conditionally create `CustomerAddress` if address data present, use `body.phone` vs `body.address_phone` distinction.

## Step 4 — Backend: Seed Script & Migrations

**Files:** `seed_database.py`

Update customer INSERT with new columns. Update address INSERT with company/phone.

## Step 5 — Frontend: Shared Types

**Files:** `packages/tenant-orm/src/types.ts`, `packages/tenant-orm/src/schemas/tenant.ts`

Extend `Customer` interface + Zod schema with new fields.

## Step 6 — Frontend: Full-Page Form Component

**File:** `apps/admin/src/components/customers/customer-form.tsx` (new)

5 sections: Overview, Address (with Collapsible country + delivery phone), Tax Exemptions, Notes, Tags. Uses shadcn `Input`, `Select`, `Checkbox`, `Switch`, `Collapsible`, `Textarea`, `Badge`, `Button`.

## Step 7 — Frontend: Wire into page.tsx

**Files:** `apps/admin/src/app/(app)/customers/page.tsx`

Add `view === "add"` render block. No changes to existing quick-add dialog.

## Step 8 — Verify

```bash
doppler run -- uv run pytest tests/ -q     # 207+ passing
cd apps/admin && npx tsc --noEmit           # clean
```
