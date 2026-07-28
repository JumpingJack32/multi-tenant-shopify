# Polish & Production Hardening — Implementation Plan

**Spec:** P2 accessibility + Sentry tuning + load test verification

---

## Step 1 — Live Regions & Reduced Motion

**Files:** `apps/storefront/src/components/storefront/cart-drawer.tsx`, `search-dialog.tsx`, modal dialogs

- Wrap dynamic status text (cart count, promo messages, search results count) in `<div aria-live="polite" aria-atomic="true">`
- Add `motion-reduce:transition-none` and `motion-reduce:transform-none` to motion-heavy elements in cart drawer slide and command menu overlay

## Step 2 — ConfirmDeleteDialog

**File:** `apps/admin/src/components/ui/confirm-delete-dialog.tsx` (new)

- Reusable dialog wrapping the existing `Dialog` component
- Accepts `title`, `description`, `onConfirm`, `onCancel`, `confirmLabel`
- Proper focus trapping, keyboard cancellation (Esc), `aria-describedby` on the warning text
- Wire into promotions page delete button, inventory delete actions

## Step 3 — Sentry Tuning

**Files:** `apps/admin/sentry.client.config.ts`, `apps/storefront/sentry.client.config.ts`

- Set `tracesSampleRate: 0.1` (already configured, verify)
- Add `beforeSend` hook to scrub passwords, tokens, credit cards from error payloads
- Ensure `NEXT_PUBLIC_SENTRY_DSN` is documented in `.env.example`

## Step 4 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
cd apps/storefront && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
