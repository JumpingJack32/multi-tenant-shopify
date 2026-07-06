# Session Context — Saved 2026-07-05

## Current State

- **127 tests, 35 files, all passing** — verified 2026-07-05
- Branch: `round-1-test-expansion` — latest commit `6e7cb82`
- **Dev servers running**: storefront on :3000, admin on :3001 — no compilation errors
- **PLP/PDP routes verified**: respond with 307 → Clerk sign-in as expected (auth-protected); brand landing (`/` and `/:tenant`) returns 200
- **PLP/PDP fully implemented**: ProductCard (ghost card, motion cross-fade), ProductGrid (server component, fetch + render), ProductGallery (client component, 16:9 hero + detail images), ProductInfo + AddToCartButton (sticky PDP sidebar, cart integration)
- **Dark mode toggle**: Shared `<ThemeToggle />` in `packages/ui/src/components/ui/`, wired into storefront (tenant header bar) and admin (user popover)
- **Routes**: Brand landing (`[tenant]/page.tsx`), full catalog (`[tenant]/shop/all`), category PLP (`[tenant]/shop/[category]`), PDP (`[tenant]/shop/[category]/[slug]`)
- **Data model**: `price` (cents), `specs`, `images` on Product type + Zod schemas; CartItem extends with `name`, `price`, `image`
- **Design system**: `DESIGN.md` rewritten to match `globals.css` (OKLCH colors, actual fonts/radii, removed speculative tokens)
- **Clerk v7 + Next.js 16**: Confirmed `proxy.ts` is correct middleware filename; middleware IS running
- **Admin**: ErrorBanner, OrdersTable, Settings form, product-form import fix
- **Cloudinary**: Backend endpoint + `src/core/cloudinary.py` module installed (not yet wired to UI)

## Next Steps

1. ~~Restart dev servers to verify PLP/PDP routes render with live data~~ ✅
2. Implement mobile sticky CTA bar on PDP (per spec)
3. Wire up Cloudinary images in place of Unsplash demo URLs
4. Add category filtering on backend (currently all PLP routes show all products — by design for now)
5. ~~Add Cloudinary env vars to Doppler~~ ✅ (verified present)

## Key Decisions

- Tests use `jsdom` + `react()` plugin in vitest config; `cleanup()` in `afterEach` required for React tests
- `@repo/tenant-orm/schemas` (not `./schemas/tenant`) is the correct import for tenant schemas
- Coverage: v8 provider, 30% threshold, exclusions in vitest.config.ts
- Secrets via Doppler only (never .env directly)
- Root `package.json` `"dev"` uses `doppler run -- pnpm turbo run dev`
- Price in cents, display as `£{(n / 100).toFixed(2)}`
- Server components for data fetching; client components for interactivity
- `@repo/ui/components/motion` re-exports `motion` + `AnimatePresence` from `motion/react`
- `@/` import alias works for vitest tests (configured in storefront's vitest.config.ts)
- ProductCard uses ghost card aesthetic (no border/shadow/background) with `bg-black`
- `proxy.ts` (not `middleware.ts`) is the correct middleware filename for Next.js 16.2.9
- `e.stopPropagation()` required in toggle click handler when placed inside Base UI/Radix menu popovers

## UI Design

- Always follow the UI design system when creating or reviewing components or pages
- Design system: @DESIGN.md

## Context

- Always follow the project context system when creating or reviewing conflicting versions
- Context system: @PROJECT_CONTEXT.md
