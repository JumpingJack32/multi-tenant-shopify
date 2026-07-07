# Session Context — Saved 2026-07-07

## Current State

- **131 tests, 36 files, all passing** — verified 2026-07-07
- Branch: `round-1-test-expansion` — latest commit `e7dd8de`
- **Dev servers running**: storefront on :3000, admin on :3001 — no compilation errors
- **DESIGN.md cleaned up**: removed duplicate paragraph, fixed `components.json` example, removed "No shadcn CLI-generated components" ban (already contradicted by `@shadcn/react` dependency), removed redundant corrective note
- **Atomic UI components added**: 50+ shadcn-style components in `packages/ui/src/components/ui/` (button, card, dialog, sidebar, etc.) with `use-mobile.ts` hook in `packages/ui/src/hooks/`
- **Component reorg**: button/card moved from `packages/ui/src/components/` → `packages/ui/src/components/ui/`, new `packages/ui/src/components/index.ts` barrel, old `components/ui/index.ts` removed
- **Test imports fixed**: `button.test.tsx` and `card.test.tsx` updated to point to new `../components/ui/` paths
- **Mobile sticky CTA bar**: implemented, tested, committed
- **PLP/PDP routes**: verified (307 → Clerk sign-in as expected for auth-protected; brand landing returns 200)
- **PLP/PDP fully implemented**: ProductCard, ProductGrid, ProductGallery, ProductInfo + AddToCartButton
- **Dark mode toggle**: Shared `<ThemeToggle />` wired into storefront + admin
- **Routes**: Brand landing, full catalog, category PLP, PDP
- **Clerk v7 + Next.js 16**: `proxy.ts` middleware confirmed running
- **Cloudinary**: Backend endpoint + `src/core/cloudinary.py` installed; storefront wired (committed); admin ImageManager with upload widget (committed); product image CRUD endpoints (committed); DB migration for product_images (committed); seed data with Cloudinary public IDs (committed)
- **Admin**: ErrorBanner, OrdersTable, Settings form, product-form

## Next Steps

1. ~~Restart dev servers to verify PLP/PDP routes render with live data~~ ✅
2. ~~Implement mobile sticky CTA bar on PDP (per spec)~~ ✅
3. ~~Wire up Cloudinary images in place of Unsplash demo URLs~~ ✅
4. Add category filtering on backend (currently all PLP routes show all products — by design for now)
5. ~~Add Cloudinary env vars to Doppler~~ ✅ (verified present)

## Key Decisions

- Tests use `jsdom` + `react()` plugin in vitest config; `cleanup()` in `afterEach` required for React tests
- `@repo/tenant-orm/schemas` (not `./schemas/tenant`) is the correct import for tenant schemas
- Coverage: v8 provider (root vitest.config.ts with workspace projects), 30% threshold
- Secrets via Doppler only (never .env directly)
- Root `package.json` `"dev"` uses `doppler run -- pnpm turbo run dev`
- Price in cents, display as `£{(n / 100).toFixed(2)}`
- Server components for data fetching; client components for interactivity
- `@repo/ui/components/motion` re-exports `motion` + `AnimatePresence` from `motion/react`
- `@/` import alias works for vitest tests (configured in storefront's vitest.config.ts project)
- ProductCard uses ghost card aesthetic (no border/shadow/background) with `bg-black`
- `proxy.ts` (not `middleware.ts`) is the correct middleware filename for Next.js 16.2.9
- `e.stopPropagation()` required in toggle click handler when placed inside Base UI/Radix menu popovers
- `MobileStickyCta` uses `document.getElementById` (not ref forwarding) — pragmatic simplification avoiding prop-drilling through server component boundary
- Safe area padding: `pb-[env(safe-area-inset-bottom)]` via Tailwind v4 arbitrary value, not inline style
- `components/motion.tsx` is the canonical motion re-export; the `"./motion"` package.json export and `index.ts` both point to `components/motion` (not `styles/motion`)
- Atomic UI components live in `packages/ui/src/components/ui/` — styled wrappers around `@repo/ui/base-ui` (which re-exports `@base-ui/react`)
- `packages/ui/package.json` exports: `./hooks/*` maps to `./src/hooks/*.ts` (`.ts` only); `./base-ui` maps to `./src/styles/base-ui.ts`
- Hook files use `.ts` extension (not `.tsx`) unless they contain JSX — `use-mobile.ts` is correct

## UI Design

- Always follow the UI design system when creating or reviewing components or pages
- Design system: @DESIGN.md

## Context

- Always follow the project context system when reviewing conflicting versions
- Context system: @PROJECT_CONTEXT.md
