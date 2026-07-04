# Session Context — Saved 2026-07-02

## Current State

- **104 tests, 28 files, 58.21% lines coverage** — all passing
- Branch: `round-1-test-expansion` — committed and pushed (97155be)
- Storefront: landing page (CatsAndDogs/Amoa & Agou), postcss.config.mjs, Tailwind v4 setup, `next-cloudinary` installed
- Admin: ErrorBanner, OrdersTable, Settings form, product-form import fix
- Cloudinary: backend `POST /api/v1/media/upload-signature` (protected by `require_admin`), `src/core/cloudinary.py` module, `cloudinary` PyPI dep added
- PLP/PDP spec written: `docs/superpowers/specs/2026-07-02-storefront-plp-pdp.md` — deferred for implementation

## Next Steps

1. Add Cloudinary env vars to Doppler: `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
2. Restart dev servers to pick up new env vars

## Key Decisions

- Tests use `jsdom` + `react()` plugin in vitest config; `cleanup()` in `afterEach` required for React tests
- `@repo/tenant-orm/schemas` (not `./schemas/tenant`) is the correct import for tenant schemas
- Coverage: v8 provider, 30% threshold, exclusions in vitest.config.ts
- Secrets via Doppler only (never .env directly)
- Root `package.json` `"dev"` uses `doppler run -- pnpm turbo run dev`
