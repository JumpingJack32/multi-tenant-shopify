# Multi-Tenant Shopify Platform — Design System

> **Source of truth:** `packages/ui/src/styles/globals.css`
> All tokens below reflect what is actually implemented. Do not override with speculative values.

---

## Design Principles & Brand Tone

High-end editorial luxury fashion minimalism with sartorialist chic. Cold, spacious, uncompromisingly clean.

- **Whitespace** as a functional design asset
- **Typography** carries almost all visual identity — serif/sans pairing
- **Motion** is subtle, hardware-accelerated, never bouncy
- **Avoid:** loud colours, heavy shadows, gradients, rounded startup UI, bright accents

---

## Shadcn UI Component Standards: Base UI Default

Components follow the shadcn/ui conventions but use `@repo/ui/base-ui` (which re-exports `@base-ui/react`) as the foundational primitive library instead of Radix UI. Block components are sourced in `packages/ui/src/components`.

### 1. Underlying Primitives

- ✅ Always import from `@repo/ui/base-ui` (Dialog, Popover, Tooltip, Menu, Select, Checkbox, Switch, etc.)
- ❌ Never import from `@radix-ui/react-*` or `@base-ui/react` directly

### 2. Render Pattern (No `asChild`)

Base UI uses the `render` prop pattern instead of Radix's `asChild` prop or `<Slot>` primitive. Always use the `render` prop to pass custom elements or merge behavior onto child components.

```tsx
// ❌ BANNED — Radix asChild pattern
<DropdownMenu.Trigger asChild><button>Click</button></DropdownMenu.Trigger>

// ✅ REQUIRED — Base UI render prop
<DropdownMenu.Trigger render={(props) => <button {...props}>Click</button>} />
```

### 3. Styling & States

Rely on Base UI's data attributes for state styling (`data-state="open"`, `data-hovered`, `data-disabled`) combined with Tailwind v4. Use clean class compositions with `cn()` where needed.

### 4. Configuration

`packages/ui/components.json` is configured with `"style": "base-sera"` and aligns with the Base UI API specification. Write all registry components to match the Base UI API.

### 5. Presentational Components

Hand-write presentational components (Card, Table) as plain HTML + Tailwind — no headless primitive needed. No shadcn CLI-generated components.

### Reference skill

The `base-ui-react` skill (from the [ClaudeSkillz](https://github.com/jackspace/ClaudeSkillz) collection) provides guidance on Base UI component patterns, the render prop API, the Positioner pattern for floating elements, and known workarounds. Note the skill references `@base-ui-components/react` — substitute `@repo/ui/base-ui` for all imports.

```
npx skills add https://github.com/jackspace/claudeskillz --skill base-ui-react
```

## 1. Colour Palette

### Root (light mode)

| Token                  | Value              | Description           |
| ---------------------- | ------------------ | --------------------- |
| `--background`         | `oklch(1 0 0)`     | White                 |
| `--foreground`         | `oklch(0.145 0 0)` | Near-black text       |
| `--muted`              | `oklch(0.97 0 0)`  | Off-white surfaces    |
| `--muted-foreground`   | `oklch(0.556 0 0)` | Secondary text        |
| `--primary`            | `oklch(0.205 0 0)` | Dark button/surface   |
| `--primary-foreground` | `oklch(0.985 0 0)` | White on dark         |
| `--border`             | `oklch(0.922 0 0)` | Hairline borders      |
| `--accent`             | `oklch(0.97 0 0)`  | Subtle accent surface |
| `--accent-foreground`  | `oklch(0.205 0 0)` | Text on accent        |
| `--ring`               | `oklch(0.708 0 0)` | Focus rings           |
| `--radius`             | `0.45rem`          | Border radius base    |

### Dark mode

| Token          | Value                |
| -------------- | -------------------- |
| `--background` | `oklch(0.145 0 0)`   |
| `--foreground` | `oklch(0.985 0 0)`   |
| `--border`     | `oklch(1 0 0 / 10%)` |
| `--primary`    | `oklch(0.922 0 0)`   |

### Theme reference

Use `@theme inline` tokens in globals.css — NOT raw hex or oklch values:

```css
bg-background text-foreground border-border bg-muted text-muted-foreground
```

---

## 2. Typography

### Font Families (set in `apps/storefront/src/app/layout.tsx`)

| Variable         | Font              | Role                       |
| ---------------- | ----------------- | -------------------------- |
| `--font-heading` | Playfair Display  | Display / headings (serif) |
| `--font-sans`    | Noto Sans         | Body / UI (sans-serif)     |
| `--font-text`    | Plus Jakarta Sans | Editorial text (warm sans) |
| `--font-mono`    | Geist Mono        | Labels / metadata (mono)   |

### Tailwind v4 class mapping

```css
font-title-heading  /* Instrument Serif — serif titles */
font-heading        /* Playfair Display — serif headings */
font-sans           /* Noto Sans — body */
font-text           /* Plus Jakarta Sans — editorial */
font-mono           /* Geist Mono — micro labels */
```

### Usage conventions

- **Headings:** Playfair Display, light weight (300–400), uppercase where editorial
- **Body:** Noto Sans, regular weight (400), comfortable leading
- **Labels/Meta:** Geist Mono, uppercase, wide tracking, small size
- **Never** use bold weights — rely on contrast and tracking

---

## 3. Border Radius

| Token          | Value                       | Use                      |
| -------------- | --------------------------- | ------------------------ |
| `--radius-sm`  | `2px`                       | Buttons, small elements  |
| `--radius-md`  | `3px`                       | Cards, medium containers |
| `--radius-lg`  | `5px`                       | Dialogs, large surfaces  |
| `--radius-xl`  | `calc(var(--radius) * 1.4)` | Extended shapes          |
| `--radius-2xl` | `calc(var(--radius) * 1.8)` |                          |
| `--radius-3xl` | `calc(var(--radius) * 2.2)` |                          |
| `--radius-4xl` | `calc(var(--radius) * 2.6)` |                          |

Tailwind v4 aliases: `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`, etc.

---

## 4. Animations

### Defined in `@theme inline`

| Token                | Definition                    |
| -------------------- | ----------------------------- |
| `--animate-marquee`  | `marquee 30s linear infinite` |
| `--animate-scale-in` | `scale-in 0.2s ease-out`      |

### Keyframes (globals.css)

```css
@keyframes marquee {
  0% {
    transform: translateX(0%);
  }
  100% {
    transform: translateX(-50%);
  }
}
```

### Motion principles

- Duration: 200–400ms
- Easing: `ease-out` or `cubic-bezier(.2,.8,.2,1)`
- Hover: opacity, subtle translateY(-2px), scale(1.01)
- Page transitions: fade + vertical movement
- Never bounce, never elastic

---

## 5. Layout & Grid

### Max containment

```
max-w-[1440px] mx-auto px-4 md:px-6
```

### Grid

```
grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8
```

### Section rhythm (asymmetric editorial)

```
Left column (text):   md:col-span-4
Right column (media): md:col-span-8 aspect-[4/5]
```

### Section spacing

Use Tailwind spacing utilities (`py-12`, `py-24`, `gap-16`, etc.). No custom spacing tokens defined.

---

## 6. Component Conventions

| Component     | Styling                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| Header        | Sticky, `border-border/40`, `bg-background/95`, `backdrop-blur-sm`, h-16   |
| Buttons       | `rounded-md`, `border-input`, bg-background or bg-primary                  |
| Cards         | `bg-card`, `text-card-foreground`, `shadow-sm`, `ring-1 ring-foreground/5` |
| Product cards | `aspect-[4/5]`, image with `object-cover`, no visible border               |
| Inputs        | `border-input`, `bg-background`, `rounded-md`, h-10                        |
| Footer        | `border-t border-border/40`, spacious, minimal                             |

---

## 7. Multi-Tenant Theming

Tenant-specific CSS variable injection via FastAPI:

```json
{
  "tenant_id": "vogue-apparel-01",
  "theme_tokens": {
    "--color-primary": "oklch(...)",
    "--color-accent": "oklch(...)"
  }
}
```

Values are set as CSS custom properties on `<html>` via layout.tsx. All components reference theme tokens through Tailwind v4 class names.

---

## Engineering Notes

- Tailwind CSS v4 — no `tailwind.config.js`, use `@theme` in CSS
- Components in `packages/ui/src/` shared by both apps
- Secret tokens via Doppler only (never `.env`)
- Favour CSS Grid over masonry libraries
- Use intrinsic image ratios (`aspect-`) to prevent layout shift
- Lazy load images below the fold
- Keep DOM structure shallow and semantic
- Lucide icons, stroke 1.5px, never filled
- WCAG AA contrast minimum, 44px tap targets

---

## Design Philosophy

> This interface should never feel like an ecommerce template.
> It should feel like an editorial fashion magazine that happens to sell clothing.

- confidence
- calmness
- expensive taste
- breathing room
- timelessness

Think: The Row, Loro Piana, Toteme, COS editorial, Aesop, Jacquemus campaigns.
