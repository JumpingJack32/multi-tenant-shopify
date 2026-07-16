# JS/TS Test Suite — Design Spec

## Goal

Establish a foundational JS/TS test suite across the monorepo's 7 active packages, starting with pure logic and stacking complexity toward integration-heavy packages. Zero existing tests today; target is **core logic coverage** — not exhaustive, but catches regressions in every module that does meaningful work.

## Scope

| Package              | Tests                                                                                       | Mocking                   |
| -------------------- | ------------------------------------------------------------------------------------------- | ------------------------- |
| `@repo/shared-utils` | `formatCurrency`, `cn`, `formatDate`, `formatRelativeTime`, `getEnvVar`, `validateEnv`      | None                      |
| `@repo/tenant-orm`   | Zod schema parsing (valid/invalid inputs per field), tenant resolver (mock Request/Headers) | None (pure)               |
| `@repo/middleware`   | Rate limiter token bucket, CORS origin matching, webhook HMAC verification                  | None (pure)               |
| `apps/storefront`    | Zustand cart store — `addItem`, `removeItem`, `clearCart`, `totalItems`, `totalPrice`       | None (pure state)         |
| `@repo/auth`         | `ApiClient.fetch` error handling, header/token injection, `createClerkMiddleware`           | Clerk `getAuth` mock      |
| `@repo/ui`           | `Button` variant rendering, `Card` children/className passthrough, `data-table` sort state  | jsdom                     |
| `apps/admin`         | `useProducts` hook, `useTenant` hook, RBAC context role/permission logic                    | msw + react-query wrapper |

**Skipped:** `@repo/codegen` — empty generated stubs, no logic to test.

## Implementation Order (bottom-up)

```
shared-utils → tenant-orm → middleware → storefront → auth → ui → admin
```

Each package depends only on packages tested before it. Integration-heavy packages (auth, ui, admin) come last.

## Tooling Strategy

### Root-Level Vitest (not per-package)

Install vitest once at monorepo root. Shared packages reference it naturally through pnpm workspace resolution.

**Root `package.json` addition:**

```json
"devDependencies": {
  "vitest": "^3.0.0"
}
```

All packages use the same binary. No version drift.

### Vitest Workspace Config

A `vitest.workspace.ts` at the monorepo root enables running all tests from a single `vitest` command while still allowing per-package isolation:

```typescript
// vitest.workspace.ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/shared-utils",
  "packages/tenant-orm",
  "packages/middleware",
  "apps/storefront",
  "packages/auth",
  "packages/ui",
  "apps/admin",
]);
```

This means `pnpm vitest` from root runs the entire suite. `pnpm vitest --project @repo/shared-utils` runs a single package.

### Per-Package Vitest Config

Each shared package gets a minimal `vitest.config.ts`. The apps already have one from the Next.js scaffold. Example for shared packages:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

Apps keep their existing vitest config (which includes jsdom, react plugins, etc.).

### No Additional Dependencies Per Package

Shared packages get zero new installs — vitest is at the root, and the packages only test pure logic or Zod schemas. No jsdom, no testing-library, no msw needed for the first 4 packages.

## Turbo.json Integration

Add a `test` task with explicit dependency ordering:

```json
"test": {
  "dependsOn": [
    "@repo/shared-utils#test",
    "@repo/tenant-orm#test",
    "@repo/middleware#test",
    "@repo/storefront#test",
    "@repo/auth#test",
    "@repo/ui#test",
    "@repo/admin#test"
  ],
  "outputs": []
}
```

Each package's `package.json` gets a `test` script: `"test": "vitest run"`.

Running `pnpm turbo test` executes the suite in strict bottom-up order. Running `pnpm vitest` from root (via workspace config) runs everything in parallel for local dev speed.

## Package-by-Package Test Plan

### 1. `@repo/shared-utils`

**Files to test:** `src/*.ts` (all exports)

| Function               | Test cases                                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| `cn()`                 | multiple class merge, conditional classes, conflicting tailwind classes |
| `formatCurrency()`     | USD/EUR, whole numbers, decimals, zero, large values                    |
| `formatDate()`         | ISO string input, locale formatting, edge dates                         |
| `formatRelativeTime()` | seconds/minutes/hours/days ago, future dates                            |
| `getEnvVar()`          | returns value when set, throws when missing                             |
| `validateEnv()`        | validates required keys, skips optional missing                         |

**Example:**

```typescript
import { describe, it, expect } from "vitest";
import { formatCurrency } from "./index";

describe("formatCurrency", () => {
  it("formats USD", () => {
    expect(formatCurrency(12.5, "USD")).toBe("$12.50");
  });

  it("handles zero", () => {
    expect(formatCurrency(0, "USD")).toBe("$0.00");
  });
});
```

### 2. `@repo/tenant-orm`

**Files to test:** `src/schemas/*.ts`, `src/tenant-resolver.ts`

| Module                       | Test cases                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `ProductSchema`              | valid product parses, missing name rejects, invalid status rejects, optional fields omitted |
| `ProductCreateSchema`        | valid input, default values applied, extra fields stripped                                  |
| `OrderSchema`                | valid order, invalid email rejects, negative total rejects                                  |
| `OrderItemSchema`            | valid item, zero quantity rejects                                                           |
| `TenantSchema`               | valid tenant, missing slug rejects, invalid status rejects                                  |
| `resolveTenantFromRequest()` | x-tenant-id header, host-based subdomain, Bearer token claim, no header → null              |

**Key constraint:** tenant resolver tests pass in a mock `Request` (or `Headers`) and assert on string/ID output. No database queries.

### 3. `@repo/middleware`

**Files to test:** `src/rate-limit.ts`, `src/cors.ts`, `src/webhooks.ts`

| Module       | Test cases                                                                            |
| ------------ | ------------------------------------------------------------------------------------- |
| Rate limiter | token consumption within limit, exceeded limit returns false, window resets after TTL |
| CORS         | matching origin returns origin, non-matching returns null, wildcard behavior          |
| Webhook HMAC | valid signature passes, tampered payload fails, missing header fails                  |

### 4. `apps/storefront` (cart store)

**Files to test:** `src/hooks/use-cart.ts`

| Test cases                                          |
| --------------------------------------------------- |
| `addItem` with new product creates entry            |
| `addItem` with existing product increments quantity |
| `removeItem` decrements / removes at zero           |
| `clearCart` empties state                           |
| `totalItems` counts quantities                      |
| `totalPrice` computes from items (if implemented)   |

### 5. `@repo/auth`

**Files to test:** `src/client.ts`, `src/hooks.ts`, `src/server.ts`

| Module                  | Test cases                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ApiClient.fetch`       | successful response returns data, 4xx/5xx throws with status, missing token sends no Auth header, token present sends Bearer |
| `createClerkMiddleware` | authenticated request passes through, unauthenticated returns 401                                                            |

**Mocking:** `vi.mock("@clerk/nextjs/server")` to control `getAuth` / `auth` return values.

### 6. `@repo/ui`

**Files to test:** `src/components/button.tsx`, `src/components/card.tsx`

| Component | Test cases                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Button`  | renders children, applies variant classes (primary/secondary/outline/ghost), applies size classes, disabled attr, onClick fires |
| `Card`    | renders children, applies className passthrough, renders CardHeader/CardTitle/CardDescription                                   |

**Setup:** Use jsdom environment (already configured in vitest for these packages via workspace config override).

### 7. `apps/admin`

**Files to test:** `src/features/products/hooks/use-products.ts`, `src/hooks/use-tenant.ts`, `src/contexts/rbac-context.tsx`

| Module             | Test cases                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `useProducts` hook | returns data on success, loading state, error state                                                       |
| `useTenant` hook   | returns tenant on success, handles null tenantId                                                          |
| RBAC context       | `can("create")` for admin returns true, `can("delete")` for viewer returns false, role defaults to viewer |

**Setup:** React Testing Library + custom render wrapper that provides QueryClient. Mock API calls with msw.

---

## Risk & Mitigation

| Risk                                  | Mitigation                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| msw setup for admin tests is complex  | Start with pure hook tests using `vi.mock` on the API service layer; add msw only if mocking becomes unwieldy                |
| jsdom + React 19 compatibility issues | Both packages already have working vitest + jsdom config from Next.js scaffold; this is a known-good path                    |
| Workspace config confuses CI vs local | Workspace config is additive — CI runs `turbo test` (isolated), local dev runs `vitest` (parallel). Both work independently. |

## Verification

Each package passes before proceeding to the next:

```bash
pnpm turbo test --filter=<package>
```

After all 7 packages are complete:

```bash
pnpm turbo test
# and
pnpm vitest run  # workspace mode
```

Both exit 0.
