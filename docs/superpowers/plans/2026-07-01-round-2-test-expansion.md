# Round 2 Test Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ~12 tests across 4 files covering shopify webhook validation, env var accessors, tenant resolution, and product card rendering.

**Architecture:** One task per test file, independent — no dependencies between tasks.

**Tech Stack:** vitest 3.x, `@testing-library/react` for jsdom tests, Node crypto for HMAC.

---

### Task 1: `middleware/shopify.test.ts`

**Files:**

- Create: `packages/middleware/src/__tests__/shopify.test.ts`

- [ ] **Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { verifyShopifySignature } from "../shopify";

describe("verifyShopifySignature", () => {
  it("returns true for valid signature", () => {
    const body = JSON.stringify({ test: "data" });
    const secret = "my-shop-secret";
    const { createHmac } = await import("crypto");
    const hmac = createHmac("sha256", secret)
      .update(body, "utf-8")
      .digest("base64");
    expect(verifyShopifySignature({ hmac, body, shopSecret: secret })).toBe(
      true,
    );
  });

  it("throws for invalid signature", () => {
    expect(() =>
      verifyShopifySignature({
        hmac: "invalid-hmac",
        body: '{"test":"data"}',
        shopSecret: "my-shop-secret",
      }),
    ).toThrow("Invalid Shopify webhook signature");
  });

  it("throws for empty body", () => {
    expect(() =>
      verifyShopifySignature({
        hmac: "some-hmac",
        body: "",
        shopSecret: "secret",
      }),
    ).toThrow("Invalid Shopify webhook signature");
  });
});
```

- [ ] **Run tests to verify they fail**

Run: `pnpm vitest run --project middleware`
Expected: 3 failures (function won't exist in that test path, or can't import)

Wait — the middleware project config includes `src/**/*.test.ts`. But the middleware test pattern might not be right. Let me check... The middleware project config in vitest.config.ts has:

```
{
  test: {
    name: "middleware",
    root: "./packages/middleware",
    include: ["src/**/*.test.ts"],
  },
}
```

So `packages/middleware/src/__tests__/shopify.test.ts` will be picked up automatically.

- [ ] **Run tests to verify they fail**

Run: `pnpm vitest run --project middleware`
Expected: 3 failures in shopify test

- [ ] **Verify tests pass**

Run: `pnpm vitest run --project middleware`
Expected: 6 passed (3 existing + 3 new)

- [ ] **Commit**

```bash
git add packages/middleware/src/__tests__/shopify.test.ts
git commit -m "test(middleware): verifyShopifySignature HMAC validation"
```

---

### Task 2: `shared-utils/env.test.ts`

**Files:**

- Create: `packages/shared-utils/src/__tests__/env.test.ts`

- [ ] **Write failing tests**

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnvVar, getEnvVarOptional, validateEnv } from "../env";

const OLD_ENV = process.env;

beforeEach(() => {
  process.env = { ...OLD_ENV };
});

afterEach(() => {
  process.env = OLD_ENV;
});

describe("getEnvVar", () => {
  it("returns value when variable exists", () => {
    process.env.TEST_VAR = "hello";
    expect(getEnvVar("TEST_VAR")).toBe("hello");
  });

  it("throws when variable is missing", () => {
    expect(() => getEnvVar("MISSING_VAR")).toThrow(
      "Missing required environment variable: MISSING_VAR",
    );
  });
});

describe("getEnvVarOptional", () => {
  it("returns value when variable exists", () => {
    process.env.TEST_OPT = "world";
    expect(getEnvVarOptional("TEST_OPT")).toBe("world");
  });

  it("returns undefined when variable is missing", () => {
    expect(getEnvVarOptional("MISSING_OPT")).toBeUndefined();
  });
});

describe("validateEnv", () => {
  it("returns all required env vars", () => {
    process.env.SUPABASE_URL = "https://supabase.test";
    process.env.SUPABASE_KEY = "sb-key";
    process.env.CLERK_SECRET_KEY = "sk_test_xxx";
    process.env.CLERK_PUBLISHABLE_KEY = "pk_test_xxx";
    const result = validateEnv();
    expect(result.SUPABASE_URL).toBe("https://supabase.test");
    expect(result.SUPABASE_KEY).toBe("sb-key");
    expect(result.CLERK_SECRET_KEY).toBe("sk_test_xxx");
    expect(result.CLERK_PUBLISHABLE_KEY).toBe("pk_test_xxx");
  });

  it("throws when any var is missing", () => {
    process.env.SUPABASE_URL = "https://supabase.test";
    // SUPABASE_KEY missing
    expect(() => validateEnv()).toThrow("SUPABASE_KEY");
  });
});
```

- [ ] **Run tests to verify they fail**

Run: `pnpm vitest run --project shared-utils`
Expected: 5 failures

- [ ] **Verify tests pass**

Run: `pnpm vitest run --project shared-utils`
Expected: 9 passed (4 existing + 5 new)

- [ ] **Commit**

```bash
git add packages/shared-utils/src/__tests__/env.test.ts
git commit -m "test(shared-utils): env var accessor validation"
```

---

### Task 3: `storefront/tenant-resolver.test.ts`

**Files:**

- Create: `apps/storefront/src/lib/__tests__/tenant-resolver.test.ts`

- [ ] **Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { resolveTenantFromRequest } from "../tenant-resolver";

describe("resolveTenantFromRequest", () => {
  it("extracts tenant from subdomain", () => {
    const req = new Request("https://acme.example.com/products");
    expect(resolveTenantFromRequest(req)).toBe("acme");
  });

  it("returns null when host is missing (browser request)", () => {
    const req = new Request("http://localhost/products");
    // In jsdom, host is "localhost" with single part — should return null
    expect(resolveTenantFromRequest(req)).toBeNull();
  });

  it("extracts tenant from query param when host has single part", () => {
    const req = new Request("http://localhost/products?tenant=my-shop");
    expect(resolveTenantFromRequest(req)).toBe("my-shop");
  });

  it("returns null when no tenant can be resolved", () => {
    const req = new Request("http://localhost/products");
    expect(resolveTenantFromRequest(req)).toBeNull();
  });
});
```

- [ ] **Run tests to verify they fail**

Run: `pnpm vitest run --project storefront`
Expected: 4 failures

- [ ] **Verify tests pass**

Run: `pnpm vitest run --project storefront`
Expected: 8 passed (4 existing + 4 new)

- [ ] **Commit**

```bash
git add apps/storefront/src/lib/__tests__/tenant-resolver.test.ts
git commit -m "test(storefront): tenant resolution from host and query params"
```

---

### Task 4: `storefront/product-card.test.tsx`

**Files:**

- Create: `apps/storefront/src/components/storefront/__tests__/product-card.test.tsx`

- [ ] **Write failing tests**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductCard } from "../product-card";

describe("ProductCard", () => {
  it("renders name and price", () => {
    render(<ProductCard name="Test Product" price={2999} />);
    expect(screen.getByText("Test Product")).toBeDefined();
    expect(screen.getByText("$29.99")).toBeDefined();
  });

  it("renders description when provided", () => {
    render(
      <ProductCard name="Test" price={1000} description="A great product" />,
    );
    expect(screen.getByText("A great product")).toBeDefined();
  });

  it("does not render description when null", () => {
    render(<ProductCard name="Test" price={1000} description={null} />);
    expect(screen.queryByText("A great product")).toBeNull();
  });
});
```

- [ ] **Run tests to verify they fail**

Run: `pnpm vitest run --project storefront`
Expected: 3 failures

- [ ] **Verify tests pass**

Run: `pnpm vitest run --project storefront`
Expected: 11 passed (8 existing + 3 new)

- [ ] **Commit**

```bash
git add apps/storefront/src/components/storefront/__tests__/product-card.test.tsx
git commit -m "test(storefront): ProductCard rendering"
```

---

### Verification

- [ ] **Run all tests**

```bash
pnpm vitest run
```

Expected: 81 tests passed (69 + 12 new)

- [ ] **Coverage check**

```bash
pnpm vitest run --coverage
```

Expected: coverage lines >= 30%
