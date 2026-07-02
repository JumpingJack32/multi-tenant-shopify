# Session Context — Saved 2026-07-01

## Current State

- **104 tests, 28 files, 58.21% lines coverage** — all passing
- Branch: `round-1-test-expansion` (includes round-2 commit)
- Uncommitted: admin UI work (ErrorBanner, Orders, Settings, tests, product-form bugfix)

## Uncommitted Changes

- `apps/admin/postcss.config.mjs` — new, enables Tailwind v4
- `apps/admin/src/app/auth/sign-in/__tests__/` — new, 3 sign-in page tests
- `apps/admin/src/components/orders/orders-table.tsx` — new, full table with status/pagination
- `apps/admin/src/components/products/__tests__/` — new, product-table (5) + product-form (6) tests
- `apps/admin/src/components/ui/error-banner.tsx` — new, dismissible error banner
- `apps/admin/src/contexts/__tests__/tenant-context.test.tsx` — new, 3 tenant context tests
- Modified: orders page, settings page, products page (ErrorBanner), layout, product-form (import fix), use-products test, globals.css, package.json, pnpm-lock

## Next Steps

1. Commit admin UI changes to round-2 branch and push
2. Run `pnpm dev` (uses Doppler) to verify admin dev server starts

## Key Decisions

- Tests use `jsdom` + `react()` plugin in vitest config; `cleanup()` in `afterEach` required for React tests
- `@repo/tenant-orm/schemas` (not `./schemas/tenant`) is the correct import for tenant schemas
- Coverage: v8 provider, 30% threshold, exclusions in vitest.config.ts
- Secrets via Doppler only (never .env directly)
- Root `package.json` `"dev"` uses `doppler run -- pnpm turbo run dev`
