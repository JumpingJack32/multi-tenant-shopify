# Dark Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dark mode toggle to both storefront and admin apps using next-themes.

**Architecture:** A shared `<ThemeToggle />` component in `packages/ui` uses Lucide Sun/Moon icons and calls `setTheme()` from next-themes with `e.stopPropagation()`. Each app wraps its content with `<ThemeProvider attribute="class">` and places the toggle in its own UI context (storefront header bar, admin user popover). CSS `.dark` class and Tailwind dark variant are already defined.

**Tech Stack:** next-themes v0.4.6, Lucide React, Tailwind v4, Base UI (admin popover)

## Global Constraints

- `attribute="class"` on ThemeProvider to match existing `.dark` CSS class
- `suppressHydrationWarning` on `<html>` in both root layouts
- `e.stopPropagation()` in toggle click handler to prevent Base UI popover from closing
- Default theme: `"light"`
- No `enableSystem` — manual toggle only
- `@repo/ui/components/ui` export path for shared components

---

### Task 1: Shared ThemeToggle component

**Files:**
- Create: `packages/ui/src/components/ui/theme-toggle.tsx`
- Modify: `packages/ui/src/components/ui/index.ts`
- Test: `packages/ui/src/__tests__/theme-toggle.test.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `<ThemeToggle />` (no props, self-contained button that reads theme and toggles)

- [ ] **Step 1: Write the failing test**

```typescript
// packages/ui/src/__tests__/theme-toggle.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "../components/ui/theme-toggle";

const mockSetTheme = vi.fn();
let mockTheme = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockTheme = "light";
    mockSetTheme.mockClear();
  });

  it("renders a button with sun icon in light mode", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDefined();
  });

  it("renders moon icon in dark mode", () => {
    mockTheme = "dark";
    render(<ThemeToggle />);
  });

  it("calls setTheme with dark when currently light", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("calls setTheme with light when currently dark", () => {
    mockTheme = "dark";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("calls stopPropagation on click", () => {
    const stopPropagation = vi.fn();
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"), { stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @repo/ui exec vitest run src/__tests__/theme-toggle.test.tsx`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write minimal implementation**

```typescript
// packages/ui/src/components/ui/theme-toggle.tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
```

- [ ] **Step 4: Export from index.ts**

```typescript
// packages/ui/src/components/ui/index.ts
export * from "./button";
export * from "./theme-toggle";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @repo/ui exec vitest run src/__tests__/theme-toggle.test.tsx`
Expected: all 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/ui/theme-toggle.tsx packages/ui/src/components/ui/index.ts packages/ui/src/__tests__/theme-toggle.test.tsx
git commit -m "feat(ui): add shared ThemeToggle component"
```

---

### Task 2: Storefront dark mode integration

**Files:**
- Modify: `apps/storefront/src/app/layout.tsx`
- Modify: `apps/storefront/src/components/providers.tsx`
- Modify: `apps/storefront/src/app/[tenant]/layout.tsx`

**Interfaces:**
- Consumes: `<ThemeToggle />` from `@repo/ui/components/ui`
- Produces: Storefront with working dark mode toggle in tenant header

- [ ] **Step 1: Write the failing test**

```typescript
// apps/storefront/src/components/__tests__/providers.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Providers } from "../providers";

describe("Providers", () => {
  it("renders children", () => {
    render(
      <Providers>
        <div data-testid="child">hello</div>
      </Providers>
    );
    expect(screen.getByTestId("child")).toBeDefined();
  });
});
```

- [ ] **Step 2: Add suppressHydrationWarning to storefront root layout**

Edit `apps/storefront/src/app/layout.tsx`:

```typescript
<html lang="en" suppressHydrationWarning>
```

- [ ] **Step 3: Add ThemeProvider to storefront Providers**

Edit `apps/storefront/src/components/providers.tsx`:

```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useMemo, type ReactNode } from "react";

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

- [ ] **Step 4: Add header with ThemeToggle to storefront tenant layout**

Edit `apps/storefront/src/app/[tenant]/layout.tsx`:

```typescript
import { ThemeToggle } from "@repo/ui/components/ui";
import { resolveTenantFromRequest } from "@/lib/tenant-resolver";

export default function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  return (
    <>
      <header className="flex h-12 items-center justify-end border-b border-border bg-background px-6">
        <ThemeToggle />
      </header>
      {children}
    </>
  );
}
```

- [ ] **Step 5: Run tests to verify**

Run: `pnpm --filter @repo/storefront exec vitest run`
Expected: all existing tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/app/layout.tsx apps/storefront/src/components/providers.tsx apps/storefront/src/app/[tenant]/layout.tsx apps/storefront/src/components/__tests__/providers.test.tsx
git commit -m "feat(storefront): add dark mode toggle with next-themes"
```

---

### Task 3: Admin dark mode integration

**Files:**
- Modify: `apps/admin/src/app/layout.tsx`
- Modify: `apps/admin/src/components/layout/header.tsx`

**Interfaces:**
- Consumes: `<ThemeToggle />` from `@repo/ui/components/ui`
- Produces: Admin dashboard with working dark mode toggle in user popover

- [ ] **Step 1: Add suppressHydrationWarning and ThemeProvider to admin root layout**

Edit `apps/admin/src/app/layout.tsx`:

```typescript
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "@repo/ui/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Multi-tenant Shopify admin control panel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <ThemeProvider attribute="class" defaultTheme="light">
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Add ThemeToggle to admin user popover**

Edit `apps/admin/src/components/layout/header.tsx` — add import and toggle inside the user popover's `div.p-1` block:

Import at top of file:
```typescript
import { ThemeToggle } from "@repo/ui/components/ui";
```

Add the toggle inside the popover, after the tenant block (before the closing `</div>` of `div.p-1`):

```typescript
                    {currentTenant && (
                      <div className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        {currentTenant.name}
                      </div>
                    )}
                    <ThemeToggle />
```

- [ ] **Step 3: Run tests to verify**

Run: `pnpm vitest run`
Expected: all 121 tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/app/layout.tsx apps/admin/src/components/layout/header.tsx
git commit -m "feat(admin): add dark mode toggle in user popover"
```

---

### Task 4: Verify full test suite

- [ ] **Step 1: Run full test suite**

Run: `pnpm vitest run`
Expected: all 121+ tests PASS

- [ ] **Step 2: Update AGENTS.md**

Record the dark mode toggle addition in the session context.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update session context with dark mode toggle"
```
