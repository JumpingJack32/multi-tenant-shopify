# Mobile Sticky CTA Bar — Design Spec

## Summary

Add a fixed-bottom sticky CTA bar to the PDP that appears on mobile/tablet viewports after the user scrolls past the inline Add to Cart button. Displays product price on the left and a reusable AddToCartButton on the right.

## Trigger

AGENTS.md step #2: "Implement mobile sticky CTA bar on PDP (per spec)"

## Requirements

- Appears only on viewports below `lg` (1024px)
- Hidden at top of page; appears when inline AddToCartButton scrolls out of view
- Smooth slide-up entrance via motion (300ms ease-out)
- Price (left) + AddToCartButton (right) in a single row
- Reuses existing `AddToCartButton` component — no duplicated cart logic
- Prevents CLS via fixed-height wrapper (`h-14`)
- Guards against mobile browser chrome with `env(safe-area-inset-bottom)`

## Architecture

### New file: `components/storefront/mobile-sticky-cta.tsx`

```
"use client"

Props:
  product: Product   — same type used by ProductInfo
  inlineButtonRef: RefObject<HTMLElement>   — ref to track inline AddToCartButton visibility

Internals:
  - useState<boolean> visible (default false)
  - IntersectionObserver watching inlineButtonRef; sets visible = true when button scrolls out
  - Renders fixed-bottom bar: hidden on lg+, visible when scrolled
  - motion.div for slide-up entrance
  - Fixed height h-14 with items-center for CLS-proof alignment
  - pb-[env(safe-area-inset-bottom)] for mobile browser chrome
  - bg-background border-t border-border
```

### Modified: `[slug]/page.tsx`

- Add `useRef` for the inline AddToCartButton wrapper
- Pass ref to ProductInfo (wraps the button in a tracked div)
- Render `<MobileStickyCta product={product} inlineButtonRef={ref} />` after the grid

### Modified: `product-info.tsx`

- Accept an optional `inlineButtonRef` prop
- Wrap the AddToCartButton section in a `<div ref={inlineButtonRef}>`

## Visual spec

```
┌────────────────────────────────────────────┐
│  fixed bottom-0 z-50 bg-background         │
│  border-t border-border                    │
│  ┌────────────────────────────────────────┐│
│  │  min-h-14 px-4 flex items-center       ││
│  │  justify-between gap-4                 ││
│  │  pb-[env(safe-area-inset-bottom)]      ││
│  │                                        ││
│  │  £129.00      [Add to Cart — auto]     ││
│  │  font-text     (AddToCartButton reused)││
│  │  text-sm                               ││
│  └────────────────────────────────────────┘│
└────────────────────────────────────────────┘
```

### DOM structure

```html
<div class="hidden lg:block">                         <!-- responsive wrapper -->
  <motion.div                                       <!-- animated entry -->
    class="fixed bottom-0 left-0 right-0 z-50
           bg-background border-t border-border"
    initial={{ y: 80 }}
    animate={{ y: visible ? 0 : 80 }}
    transition={{ duration: 0.3, ease: 'easeOut' }}
  >
    <div class="min-h-14 px-4 flex items-center
                justify-between gap-4"
         style="padding-bottom: env(safe-area-inset-bottom)">
      <span class="text-sm font-text text-foreground">
        £{(product.price / 100).toFixed(2)}
      </span>
      <AddToCartButton product={product} />
    </div>
  </motion.div>
</div>
```

### Key details

- **Outer wrapper**: `hidden lg:block` — responsive hiding on a static div, no motion conflict
- **motion.div**: handles slide-up entrance only; inherits visibility from wrapper
- **Inner flex row**: `min-h-14` — guarantees minimum height while allowing the container to grow for safe-area padding
- **Safe area**: `padding-bottom: env(safe-area-inset-bottom)` on the flex row — expands total bar height naturally instead of crunching a fixed `h-14`
- **CLS prevention**: `min-h-14` keeps the row tall enough to absorb any AddToCartButton height shifts without layout jank
- **Price**: left-aligned, `text-sm font-text`
- **Button**: right-aligned, reuses `AddToCartButton` unchanged

## Edge cases

- **No product data**: MobileStickyCta renders nothing if product is null/undefined
- **Safari bottom bar**: env(safe-area-inset-bottom) handles both iOS Safari and Chrome
- **Resize from mobile to desktop**: Observer cleanup on unmount; bar hidden via CSS at lg+
- **Fast scroll**: IntersectionObserver threshold 0 with rootMargin handles edge detection reliably
- **Double buttons**: Guaranteed by scroll-triggered visibility — inline button must be fully out of view before sticky bar appears

## Files changed

- `apps/storefront/src/components/storefront/mobile-sticky-cta.tsx` — new
- `apps/storefront/src/components/storefront/product-info.tsx` — accept ref prop
- `apps/storefront/src/app/[tenant]/shop/[category]/[slug]/page.tsx` — wire ref + MobileStickyCta
