# Storefront Performance & Edge Caching — Implementation Plan

**Goal:** Sub-50ms TTFB on navigation + PLP endpoints using Next.js native caching. No Redis dependency.

---

## Step 1 — Next.js fetch Caching (storefront-api.ts)

**File:** `apps/storefront/src/lib/storefront-api.ts`

Add `next: { revalidate }` to the `fetchJson` helper for cacheable endpoints:

| Function | `revalidate` | Rationale |
|----------|-------------|-----------|
| `fetchNavigation` | `3600` (1 hour) | Changes only when admin saves nav tree |
| `fetchStorefrontProducts` | `60` (1 minute) | Products may update frequently |
| `fetchStorefrontProduct` | `300` (5 minutes) | PDP details, stock changes rare |
| `fetchSettings` | `3600` (1 hour) | Tenant settings rarely change |

These use Next.js App Router's built-in HTTP `fetch` cache, which works automatically in server components. No extra infrastructure.

---

## Step 2 — Cache Invalidation via revalidateTag

**File:** `services/backend-api/src/routes/navigation_admin.py` + admin product endpoints

After saving the navigation tree or updating a product, the admin backend calls the Next.js `revalidatePath` endpoint:

The storefront exposes a simple `POST /api/revalidate` route that calls `revalidateTag` for `navigation` and `products` tags.

**File:** `apps/storefront/src/app/api/revalidate/route.ts` (new)

```ts
export async function POST(request: Request) {
  const { secret, tag } = await request.json();
  if (secret !== process.env.REVALIDATION_SECRET) return Response.json({ error: "Unauthorized" }, { status: 401 });
  revalidateTag(tag);
  return Response.json({ revalidated: true });
}
```

The admin backend calls this route after relevant mutations, using a shared `REVALIDATION_SECRET` environment variable.

---

## Step 3 — Tag fetch calls

**File:** `apps/storefront/src/lib/storefront-api.ts`

Add `next: { tags: [...] }` alongside `revalidate`:

- `fetchNavigation` → tag: `"navigation"`
- `fetchStorefrontProducts` → tag: `"products"`
- `fetchStorefrontProduct` → tag: `"products"`

This allows granular invalidation: saving the nav tree only clears the navigation cache, not all products.

---

## Step 4 — Verify

```bash
cd apps/storefront && pnpm tsc --noEmit
cd apps/storefront && pnpm exec eslint src/ --quiet
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
```
