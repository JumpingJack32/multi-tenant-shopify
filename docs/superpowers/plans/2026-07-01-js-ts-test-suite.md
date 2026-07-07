# JS/TS Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish core-logic test coverage across 7 monorepo packages, ordered bottom-up from pure functions to integration-heavy hooks.

**Architecture:** Root-level vitest binary with a workspace config, per-package `vitest.config.ts`, and Turborepo `^test` dependency ordering. Tests start with zero-mock pure logic and add mocking layers (jsdom, msw, Clerk) only where necessary.

**Tech Stack:** vitest 3.x, @testing-library/react, msw, jsdom

## Global Constraints

- vitest is installed ONLY at monorepo root (`package.json` devDependencies) — never per-package
- All packages get `"test": "vitest run"` script
- No new dependencies beyond what's listed in the spec
- Tests use native vitest APIs (no jest globals)
- Each package's `vitest.config.ts` is minimal — just `include` pattern and env where needed

---

## File Structure

### New files to create:

| File | Purpose |
|---|---|
| `vitest.workspace.ts` (root) | Workspace config pointing to all 7 testable packages |
| `packages/shared-utils/vitest.config.ts` | Minimal config, node env |
| `packages/tenant-orm/vitest.config.ts` | Minimal config, node env |
| `packages/middleware/vitest.config.ts` | Minimal config, node env |
| `apps/storefront/vitest.config.ts` | Node env for Zustand store (no DOM needed) |
| `packages/auth/vitest.config.ts` | Node env (no DOM needed for API client tests) |
| `packages/ui/vitest.config.ts` | jsdom env for component render tests |
| `apps/admin/vitest.config.ts` | jsdom env + React plugin for hook tests |

### Existing files to modify:

| File | Change |
|---|---|
| `package.json` (root) | Add `vitest` to devDependencies |
| `turbo.json` | Add `test` task with `dependsOn: ["^test"]` |
| `apps/admin/package.json` | Remove `vitest` from devDependencies, add `test` script |
| `apps/storefront/package.json` | Remove `vitest` from devDependencies, add `test` script |
| `packages/shared-utils/package.json` | Add `test` script |
| `packages/tenant-orm/package.json` | Add `test` script |
| `packages/middleware/package.json` | Add `test` script |
| `packages/auth/package.json` | Add `test` script |
| `packages/ui/package.json` | Add `test` script |

### New test files to create:

| File | Tests |
|---|---|
| `packages/shared-utils/src/__tests__/format-currency.test.ts` | formatCurrency |
| `packages/shared-utils/src/__tests__/cn.test.ts` | cn() |
| `packages/shared-utils/src/__tests__/dates.test.ts` | formatDate, formatRelativeTime |
| `packages/tenant-orm/src/__tests__/product-schema.test.ts` | ProductSchema, ProductCreateSchema |
| `packages/tenant-orm/src/__tests__/order-schema.test.ts` | OrderSchema, OrderItemSchema |
| `packages/tenant-orm/src/__tests__/tenant-resolver.test.ts` | resolveTenantFromRequest |
| `packages/middleware/src/__tests__/rate-limit.test.ts` | Rate limiter |
| `packages/middleware/src/__tests__/cors.test.ts` | CORS |
| `packages/middleware/src/__tests__/webhooks.test.ts` | HMAC verification |
| `apps/storefront/src/hooks/__tests__/use-cart.test.ts` | Zustand cart store |
| `packages/auth/src/__tests__/api-client.test.ts` | ApiClient |
| `packages/auth/src/__tests__/middleware.test.ts` | createClerkMiddleware |
| `packages/ui/src/__tests__/button.test.tsx` | Button variants |
| `packages/ui/src/__tests__/card.test.tsx` | Card rendering |
| `apps/admin/src/features/products/hooks/__tests__/use-products.test.ts` | useProducts hook |
| `apps/admin/src/contexts/__tests__/rbac-context.test.ts` | RBAC role/permission logic |

---

## Task 0: Infrastructure — Root vitest, workspace config, turbo task

**Files:**
- Modify: `package.json` (root)
- Modify: `turbo.json`
- Modify: `apps/admin/package.json`
- Modify: `apps/storefront/package.json`
- Modify: `packages/shared-utils/package.json`
- Modify: `packages/tenant-orm/package.json`
- Modify: `packages/middleware/package.json`
- Modify: `packages/auth/package.json`
- Modify: `packages/ui/package.json`
- Create: `vitest.workspace.ts`
- Create: `packages/shared-utils/vitest.config.ts`
- Create: `packages/tenant-orm/vitest.config.ts`
- Create: `packages/middleware/vitest.config.ts`
- Create: `apps/storefront/vitest.config.ts`
- Create: `packages/auth/vitest.config.ts`
- Create: `packages/ui/vitest.config.ts`
- Create: `apps/admin/vitest.config.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `pnpm vitest run` works from root, `pnpm turbo test` cascades by dep graph

- [ ] **Step 1: Add vitest to root devDependencies and test scripts to all packages**

Edit `package.json`:
```json
"devDependencies": {
  "vitest": "^3.0.0",
  ...
}
```

Edit each package's `package.json` adding `"test": "vitest run"` to scripts.

Remove `vitest` from `apps/admin/package.json` and `apps/storefront/package.json` devDependencies (now at root).

- [ ] **Step 2: Add test task to turbo.json**

```json
"test": {
  "dependsOn": ["^test"],
  "outputs": []
}
```

- [ ] **Step 3: Create root vitest.workspace.ts**

```typescript
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

- [ ] **Step 4: Create per-package vitest configs**

For shared packages (node env, no DOM):
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

For `apps/storefront` (Zustand store — node env, no DOM):
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

For `packages/ui` and `apps/admin` (need jsdom):
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "jsdom",
  },
});
```

- [ ] **Step 5: Run infrastructure check**

```bash
pnpm install
pnpm vitest run --project shared-utils  # Should exit 0 (no tests yet)
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: add vitest workspace, per-package configs, and turbo test task"
```

---

## Task 1: @repo/shared-utils — Pure utility function tests

**Files:**
- Create: `packages/shared-utils/src/__tests__/format-currency.test.ts`
- Create: `packages/shared-utils/src/__tests__/cn.test.ts`
- Create: `packages/shared-utils/src/__tests__/dates.test.ts`

**Interfaces:**
- Consumes: `cn()`, `formatCurrency()`, `formatDate()`, `formatRelativeTime()` from `packages/shared-utils/src/index.ts`
- Produces: 100% coverage of exported utility functions

- [ ] **Step 1: Write and run cn() tests**

```typescript
import { describe, it, expect } from "vitest";
import { cn } from "../index";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("resolves tailwind conflicts (later wins)", () => {
    expect(cn("px-4", "px-2")).toBe("px-2");
  });

  it("returns empty string for no args", () => {
    expect(cn()).toBe("");
  });
});
```

Run: `pnpm vitest run --project shared-utils` — tests pass.

- [ ] **Step 2: Write and run formatCurrency() tests**

```typescript
import { describe, it, expect } from "vitest";
import { formatCurrency } from "../index";

describe("formatCurrency", () => {
  it("formats USD", () => {
    expect(formatCurrency(12.5, "USD")).toBe("$12.50");
  });

  it("formats EUR", () => {
    expect(formatCurrency(12.5, "EUR")).toBe("€12.50");
  });

  it("handles zero", () => {
    expect(formatCurrency(0, "USD")).toBe("$0.00");
  });

  it("handles large values", () => {
    expect(formatCurrency(1234567.89, "USD")).toBe("$1,234,567.89");
  });
});
```

Run: `pnpm vitest run --project shared-utils` — tests pass.

- [ ] **Step 3: Write and run date function tests**

```typescript
import { describe, it, expect } from "vitest";
import { formatDate, formatRelativeTime } from "../index";

describe("formatDate", () => {
  it("formats an ISO string", () => {
    const result = formatDate("2026-06-01T12:00:00Z");
    expect(result).toContain("2026");
  });
});

describe("formatRelativeTime", () => {
  it('returns "just now" for recent dates', () => {
    const result = formatRelativeTime(new Date().toISOString());
    expect(result).toBe("just now");
  });
});
```

Run: `pnpm vitest run --project shared-utils` — tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/shared-utils/
git commit -m "test(shared-utils): add utility function tests (cn, formatCurrency, dates)"
```

---

## Task 2: @repo/tenant-orm — Zod schema and tenant resolver tests

**Files:**
- Create: `packages/tenant-orm/src/__tests__/product-schema.test.ts`
- Create: `packages/tenant-orm/src/__tests__/order-schema.test.ts`
- Create: `packages/tenant-orm/src/__tests__/tenant-resolver.test.ts`

**Interfaces:**
- Consumes: `ProductSchema`, `ProductCreateSchema`, `OrderSchema`, `OrderItemSchema` from `packages/tenant-orm/src/schemas/tenant.ts`; `resolveTenantFromRequest` from `packages/tenant-orm/src/tenant-resolver.ts`
- Produces: Schema validation and tenant resolution coverage

- [ ] **Step 1: Write and run product schema tests**

```typescript
import { describe, it, expect } from "vitest";
import { ProductSchema, ProductCreateSchema } from "../schemas/tenant";

describe("ProductSchema", () => {
  it("parses a valid product", () => {
    const result = ProductSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      tenant_id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Test Product",
      slug: "test-product",
      status: "published",
      weight_unit: "kg",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(result.name).toBe("Test Product");
  });

  it("rejects missing name", () => {
    expect(() =>
      ProductSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenant_id: "550e8400-e29b-41d4-a716-446655440001",
        slug: "test-product",
        status: "published",
        weight_unit: "kg",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      })
    ).toThrow();
  });

  it("rejects invalid status", () => {
    expect(() =>
      ProductSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenant_id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Test",
        slug: "test",
        status: "nonexistent",
        weight_unit: "kg",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      })
    ).toThrow();
  });
});

describe("ProductCreateSchema", () => {
  it("applies default values for optional fields", () => {
    const result = ProductCreateSchema.parse({
      name: "Test",
      slug: "test",
    });
    expect(result.status).toBe("draft");
    expect(result.is_active).toBe(true);
    expect(result.weight_unit).toBe("kg");
  });
});
```

Run: `pnpm vitest run --project tenant-orm` — tests pass.

- [ ] **Step 2: Write and run order schema tests**

```typescript
import { describe, it, expect } from "vitest";
import { OrderSchema, OrderItemSchema } from "../schemas/tenant";

describe("OrderSchema", () => {
  it("parses a valid order", () => {
    const result = OrderSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      tenant_id: "550e8400-e29b-41d4-a716-446655440001",
      customer_email: "test@example.com",
      status: "confirmed",
      total: 2999,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    expect(result.total).toBe(2999);
  });

  it("rejects invalid email", () => {
    expect(() =>
      OrderSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenant_id: "550e8400-e29b-41d4-a716-446655440001",
        customer_email: "not-an-email",
        status: "pending",
        total: 1000,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      })
    ).toThrow();
  });

  it("rejects negative total", () => {
    expect(() =>
      OrderSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        tenant_id: "550e8400-e29b-41d4-a716-446655440001",
        customer_email: "test@example.com",
        status: "pending",
        total: -100,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      })
    ).toThrow();
  });
});

describe("OrderItemSchema", () => {
  it("parses a valid order item", () => {
    const result = OrderItemSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      order_id: "550e8400-e29b-41d4-a716-446655440001",
      product_id: "550e8400-e29b-41d4-a716-446655440002",
      tenant_id: "550e8400-e29b-41d4-a716-446655440003",
      quantity: 2,
      unit_price: 1500,
    });
    expect(result.quantity).toBe(2);
  });

  it("rejects zero quantity", () => {
    expect(() =>
      OrderItemSchema.parse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        order_id: "550e8400-e29b-41d4-a716-446655440001",
        product_id: "550e8400-e29b-41d4-a716-446655440002",
        tenant_id: "550e8400-e29b-41d4-a716-446655440003",
        quantity: 0,
        unit_price: 1500,
      })
    ).toThrow();
  });
});
```

Run: `pnpm vitest run --project tenant-orm` — tests pass.

- [ ] **Step 3: Write and run tenant resolver tests**

```typescript
import { describe, it, expect } from "vitest";
import { resolveTenantFromRequest } from "../tenant-resolver";

describe("resolveTenantFromRequest", () => {
  it("extracts tenant from x-tenant-id header", () => {
    const req = new Request("http://localhost", {
      headers: { "x-tenant-id": "550e8400-e29b-41d4-a716-446655440000" },
    });
    expect(resolveTenantFromRequest(req)).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("extracts tenant from host subdomain", () => {
    const req = new Request("http://acme.localhost");
    expect(resolveTenantFromRequest(req)).toBe("acme");
  });

  it("returns null when no tenant context found", () => {
    const req = new Request("http://localhost");
    expect(resolveTenantFromRequest(req)).toBeNull();
  });

  it("extracts tenant from Bearer token claims", () => {
    // Create a JWT-like payload with tenant_id claim
    const payload = Buffer.from(JSON.stringify({ tenant_id: "tenant-123" })).toString("base64url");
    const req = new Request("http://localhost", {
      headers: { authorization: `Bearer header.${payload}.sig` },
    });
    expect(resolveTenantFromRequest(req)).toBe("tenant-123");
  });
});
```

Run: `pnpm vitest run --project tenant-orm` — tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/tenant-orm/
git commit -m "test(tenant-orm): add Zod schema and tenant resolver tests"
```

---

## Task 3: @repo/middleware — Rate limiter, CORS, webhook tests

**Files:**
- Create: `packages/middleware/src/__tests__/rate-limit.test.ts`
- Create: `packages/middleware/src/__tests__/cors.test.ts`
- Create: `packages/middleware/src/__tests__/webhooks.test.ts`

**Interfaces:**
- Consumes: rate limiter, CORS, webhook verification from `packages/middleware/src/`
- Produces: Core middleware logic coverage

- [ ] **Step 1: Write and run rate limiter tests**

```typescript
import { describe, it, expect } from "vitest";
import { rateLimit } from "../rate-limit";

describe("rateLimit", () => {
  it("allows requests within limit", () => {
    const result = rateLimit("test-key", { maxRequests: 5, windowMs: 60000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks requests exceeding limit", () => {
    const key = "exceed-key";
    for (let i = 0; i < 3; i++) {
      rateLimit(key, { maxRequests: 2, windowMs: 60000 });
    }
    const result = rateLimit(key, { maxRequests: 2, windowMs: 60000 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
```

Run: `pnpm vitest run --project middleware` — tests pass.

- [ ] **Step 2: Write and run CORS tests**

```typescript
import { describe, it, expect } from "vitest";
import { cors } from "../cors";

describe("cors", () => {
  it("allows matching origin", () => {
    const result = cors("https://example.com", { allowedOrigins: ["https://example.com"] });
    expect(result).toBe("https://example.com");
  });

  it("rejects non-matching origin", () => {
    const result = cors("https://evil.com", { allowedOrigins: ["https://example.com"] });
    expect(result).toBeNull();
  });

  it("allows wildcard", () => {
    const result = cors("https://anything.com", { allowedOrigins: ["*"] });
    expect(result).toBe("*");
  });
});
```

Run: `pnpm vitest run --project middleware` — tests pass.

- [ ] **Step 3: Write and run webhook HMAC tests**

```typescript
import { describe, it, expect } from "vitest";
import { verifyWebhook } from "../webhooks";

describe("verifyWebhook", () => {
  it("rejects missing signature header", () => {
    expect(() => verifyWebhook("payload", "", "secret")).toThrow();
  });
});
```

Run: `pnpm vitest run --project middleware` — tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/middleware/
git commit -m "test(middleware): add rate limiter, CORS, and webhook tests"
```

---

## Task 4: apps/storefront — Zustand cart store tests

**Files:**
- Create: `apps/storefront/src/hooks/__tests__/use-cart.test.ts`

**Interfaces:**
- Consumes: `useCartStore` from `apps/storefront/src/hooks/use-cart.ts`
- Produces: Cart state logic coverage

- [ ] **Step 1: Write and run cart store tests**

```typescript
import { describe, it, expect } from "vitest";
import { useCartStore } from "../use-cart";

describe("useCartStore", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], isOpen: false });
  });

  it("adds a new item", () => {
    useCartStore.getState().addItem({ id: "1", name: "Test", price: 1000 });
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });

  it("increments quantity for existing item", () => {
    useCartStore.getState().addItem({ id: "1", name: "Test", price: 1000 });
    useCartStore.getState().addItem({ id: "1", name: "Test", price: 1000 });
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(2);
  });

  it("removes an item", () => {
    useCartStore.getState().addItem({ id: "1", name: "Test", price: 1000 });
    useCartStore.getState().removeItem("1");
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("clears the cart", () => {
    useCartStore.getState().addItem({ id: "1", name: "Test", price: 1000 });
    useCartStore.getState().addItem({ id: "2", name: "Test 2", price: 2000 });
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("computes total items", () => {
    useCartStore.getState().addItem({ id: "1", name: "Test", price: 1000 });
    useCartStore.getState().addItem({ id: "1", name: "Test", price: 1000 });
    useCartStore.getState().addItem({ id: "2", name: "Test 2", price: 2000 });
    expect(useCartStore.getState().totalItems()).toBe(3);
  });
});
```

Run: `pnpm vitest run --project storefront` — tests pass.

- [ ] **Step 2: Commit**

```bash
git add apps/storefront/
git commit -m "test(storefront): add Zustand cart store tests"
```

---

## Task 5: @repo/auth — ApiClient and middleware tests

**Files:**
- Create: `packages/auth/src/__tests__/api-client.test.ts`
- Create: `packages/auth/src/__tests__/middleware.test.ts`

**Interfaces:**
- Consumes: `ApiClient`, `createApiClient` from `packages/auth/src/client.ts`; `createClerkMiddleware` from `packages/auth/src/middleware.ts`
- Produces: API client and middleware coverage (with Clerk mocking)

- [ ] **Step 1: Write and run API client tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient } from "../client";

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient({ baseUrl: "http://localhost:8000" });
  });

  it("sends a GET request and returns JSON", async () => {
    const mockData = { id: "1", name: "Test" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await client.get("/products");
    expect(result).toEqual(mockData);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:8000/products",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("throws on 4xx response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () => Promise.resolve({ message: "Not found" }),
    });

    await expect(client.get("/products/999")).rejects.toThrow("Not found");
  });

});
```

Run: `pnpm vitest run --project auth` — tests pass.

- [ ] **Step 2: Write and run middleware tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { createClerkMiddleware } from "../middleware";

describe("createClerkMiddleware", () => {
  it("returns a middleware function", () => {
    const middleware = createClerkMiddleware({ secretKey: "test-secret" });
    expect(typeof middleware).toBe("function");
  });

});
```

Run: `pnpm vitest run --project auth` — tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/auth/
git commit -m "test(auth): add ApiClient and middleware tests"
```

---

## Task 6: @repo/ui — Component render tests

**Files:**
- Create: `packages/ui/src/__tests__/button.test.tsx`
- Create: `packages/ui/src/__tests__/card.test.tsx`

**Interfaces:**
- Consumes: `Button` from `packages/ui/src/components/button.tsx`; `Card`, `CardHeader`, `CardTitle`, `CardDescription` from `packages/ui/src/components/card.tsx`
- Produces: Component rendering coverage (jsdom env)

- [ ] **Step 1: Write and run Button tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../components/button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeDefined();
  });

  it("applies variant classes", () => {
    render(<Button variant="primary">Primary</Button>);
    const btn = screen.getByText("Primary");
    // check that the class list contains the variant class
    expect(btn.className).toContain("primary");
  });

  it("fires onClick handler", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByText("Click"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("respects disabled prop", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByText("Disabled")).toBeDisabled();
  });
});
```

Run: `pnpm vitest run --project ui` — tests pass.

- [ ] **Step 2: Write and run Card tests**

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card><CardHeader><CardTitle>Title</CardTitle></CardHeader></Card>);
    expect(screen.getByText("Title")).toBeDefined();
  });

  it("passes through className", () => {
    render(<Card className="custom">Content</Card>);
    expect(screen.getByText("Content").className).toContain("custom");
  });
});

describe("CardDescription", () => {
  it("renders description text", () => {
    render(<CardDescription>Description text</CardDescription>);
    expect(screen.getByText("Description text")).toBeDefined();
  });
});
```

Run: `pnpm vitest run --project ui` — tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/
git commit -m "test(ui): add Button and Card component render tests"
```

---

## Task 7: apps/admin — Hook and context tests

**Files:**
- Create: `apps/admin/src/features/products/hooks/__tests__/use-products.test.ts`
- Create: `apps/admin/src/contexts/__tests__/rbac-context.test.ts`

**Interfaces:**
- Consumes: `useProducts` from `apps/admin/src/features/products/hooks/use-products.ts`; `RbacProvider`, `useRbac` from `apps/admin/src/contexts/rbac-context.tsx`
- Produces: Data fetching hook and RBAC logic coverage (msw + react-query)

- [ ] **Step 1: Write and run useProducts hook tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useProducts } from "../use-products";
import type { ReactNode } from "react";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useProducts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns products on success", async () => {
    const mockProducts = [
      { id: "1", name: "Product A", slug: "product-a", status: "published" },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockProducts, total: 1 }),
    });

    const { result } = renderHook(() => useProducts({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeDefined();
  });

  it("handles error state", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useProducts({}), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
```

Run: `pnpm vitest run --project admin` — tests pass.

- [ ] **Step 2: Write and run RBAC context tests**

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RbacProvider, useRbac } from "../rbac-context";

function TestComponent() {
  const { role, can } = useRbac();
  return <div data-testid="role">{role} - {can("create") ? "can create" : "cannot create"}</div>;
}

describe("RbacProvider", () => {
  it("provides admin role with full access", () => {
    render(
      <RbacProvider role="admin">
        <TestComponent />
      </RbacProvider>,
    );
    expect(screen.getByTestId("role").textContent).toContain("admin");
    expect(screen.getByTestId("role").textContent).toContain("can create");
  });

  it("provides viewer role with limited access", () => {
    render(
      <RbacProvider role="viewer">
        <TestComponent />
      </RbacProvider>,
    );
    expect(screen.getByTestId("role").textContent).toContain("viewer");
    expect(screen.getByTestId("role").textContent).toContain("cannot create");
  });
});
```

Run: `pnpm vitest run --project admin` — tests pass.

- [ ] **Step 3: Run full suite**

```bash
pnpm vitest run
```

Expected: all 7 projects pass, exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/
git commit -m "test(admin): add useProducts hook and RBAC context tests"
```

---

## Task 8 (Optional): Enable test turbo task in CI

**Files:**
- Modify: `turbo.json` (already done in Task 0)

The `test` task is already configured. Run full pipeline:

```bash
pnpm turbo test
```

Expected: all tasks execute in dependency order, all pass, exit 0.
