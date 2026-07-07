# Session Context — Saved 2026-07-07

## Current State

- **131 tests, 36 files, all passing** — verified 2026-07-07
- Branch: `round-1-test-expansion` — latest commit `d60eee7`
- **Branch complete** — pushed to origin, PR ready at `main...round-1-test-expansion`
- **Dev servers running**: storefront on :3000, admin on :3001 — no compilation errors
- **PLP/PDP fully implemented**: ProductCard, ProductGrid, ProductGallery, ProductInfo, AddToCartButton, MobileStickyCta
- **Cloudinary**: Full pipeline — backend signed upload API, StorefrontImage, admin ImageManager, product image CRUD, DB migration 0003, seed data
- **Dark mode**: Shared ThemeToggle wired into storefront + admin
- **Atomic UI library**: 50+ shadcn-style components in packages/ui
- **Admin**: ImageManager, ErrorBanner, OrdersTable, Settings form, product-form drawer
- **Design tokens**: OKLCH palette, Plus Jakarta Sans, globals.css cleanup

## Next Steps (for next branch)

1. Add category filtering on backend (currently all PLP routes show all products — by design for now)

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
