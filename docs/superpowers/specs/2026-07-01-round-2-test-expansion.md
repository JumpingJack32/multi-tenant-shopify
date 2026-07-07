# Round 2: Test Expansion — Middleware, Storefront, Shared-Utils

## Scope
Add ~12 tests across 4 new test files in 3 packages:

### 1. `packages/middleware/src/__tests__/shopify.test.ts`
- **Target**: `shopify.ts` — `verifyShopifySignature()`
- **Tests**: valid HMAC, invalid HMAC → throws, malformed input edge cases

### 2. `packages/shared-utils/src/__tests__/env.test.ts`
- **Target**: `env.ts` — `getEnvVar()`, `getEnvVarOptional()`, `validateEnv()`
- **Tests**: happy path, missing required → throws, optional missing → undefined, validateEnv returns all vars

### 3. `apps/storefront/src/lib/__tests__/tenant-resolver.test.ts`
- **Target**: `lib/tenant-resolver.ts` — `resolveTenantFromRequest()`
- **Tests**: subdomain extraction, no host → null, tenant query param, host with single part

### 4. `apps/storefront/src/components/storefront/__tests__/product-card.test.tsx`
- **Target**: `components/storefront/product-card.tsx` — `ProductCard`
- **Tests**: renders name/price, renders description when provided, omits description when null

## Excluded from Round 2
- `storefront/proxy.ts` — trivial re-export
- `storefront/components/providers.tsx` — needs `next/navigation` mock
- Route pages/layouts — need App Router test infra
- `storefront/lib/utils.ts` — trivial `cn` re-export
