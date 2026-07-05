# Dark Mode Toggle — Spec

Add a dark mode toggle using next-themes to both apps (storefront and admin). The dark mode CSS variables are already defined in globals.css; this wires up the runtime toggle.

## Architecture

### ThemeProvider — next-themes wrapper

- `attribute="class"` — matches the existing `.dark` CSS class in globals.css that Tailwind v4 reads via `@custom-variant dark (&:is(.dark *))`
- `defaultTheme="light"` — preserves current appearance
- `suppressHydrationWarning` on `<html>` in both root layouts (required by next-themes to avoid SSR mismatch during hydration)

### ThemeToggle — shared component

- Location: `packages/ui/src/components/ui/theme-toggle.tsx`
- Exports a single `<ThemeToggle />` component
- Uses `useTheme()` from next-themes to read current theme and `setTheme()` to toggle `"light"` / `"dark"`
- Icon: Lucide `Sun` (light mode) / `Moon` (dark mode), stroke 1.5px per design system convention
- Styled to match the host app context via Tailwind classes (no app-specific theming baked in)
- Exported from `packages/ui/src/components/ui/index.ts` alongside existing button

## Integration Points

### Storefront — `apps/storefront/src/components/providers.tsx`

Add `<ThemeProvider>` wrapping `<QueryClientProvider>`:

```tsx
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = useMemo(() => new QueryClient(), []);
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

### Storefront — `apps/storefront/src/app/[tenant]/layout.tsx`

Add a minimal header bar with the ThemeToggle. The storefront has no header today; this creates a thin utility bar:

```tsx
import { ThemeToggle } from "@repo/ui/components/ui";
// ...
<header className="flex h-12 items-center justify-end border-b border-border px-6">
  <ThemeToggle />
</header>
```

Also add `suppressHydrationWarning` to `<html>` in the root layout (`apps/storefront/src/app/layout.tsx`).

### Admin — `apps/admin/src/app/layout.tsx`

Add `suppressHydrationWarning` on `<html>` and wrap content with `<ThemeProvider>` inside `<body>`:

```tsx
import { ThemeProvider } from "next-themes";
// ...
<html lang="en" suppressHydrationWarning>
<body className={inter.className}>
  <ThemeProvider attribute="class" defaultTheme="light">
    {children}
  </ThemeProvider>
</body>
```

### Admin — `apps/admin/src/components/layout/header.tsx`

Add a `<ThemeToggle />` inside the user popover as a `Menu.Item`. The popover already shows user info (name, email, role, tenant); the toggle goes alongside these as a user preference:

```tsx
<Menu.Item>
  <ThemeToggle />
</Menu.Item>
```

## Files Changed

| File | Action |
|------|--------|
| `packages/ui/src/components/ui/theme-toggle.tsx` | Create |
| `packages/ui/src/components/ui/index.ts` | Edit — add export |
| `apps/storefront/src/app/layout.tsx` | Edit — suppressHydrationWarning |
| `apps/storefront/src/components/providers.tsx` | Edit — add ThemeProvider |
| `apps/storefront/src/app/[tenant]/layout.tsx` | Edit — add header + ThemeToggle |
| `apps/admin/src/app/layout.tsx` | Edit — add ThemeProvider + suppressHydrationWarning |
| `apps/admin/src/components/layout/header.tsx` | Edit — add ThemeToggle in user popover |

## Non-Goals

- No custom keyboard shortcut (per user request)
- No system theme detection (`enableSystem` not needed — user explicitly wants manual toggle)
- No theme persistence beyond next-themes default localStorage behavior
- No changes to admin sidebar or storefront beyond the two integration points above
