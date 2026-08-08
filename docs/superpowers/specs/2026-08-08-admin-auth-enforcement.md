# Admin Auth Enforcement (P0 security fix)

**Goal:** Close the largest security gap before go-live — the admin app currently exposes every page (`/dashboard`, `/orders`, `/settings`, `/products`, etc.) without Clerk authentication. Any unauthenticated user can reach them; frontend RBAC guards are bypassed entirely.

---

## 1. Current state (vulnerability)

`apps/admin/src/proxy.ts` lists **all admin pages** in `isPublicRoute`:

```ts
const isPublicRoute = createRouteMatcher([
  "/",
  "/auth/sign-in(.*)",
  "/api/webhooks/(.*)",
  "/api/v1/(.*)",
  "/dashboard(.*)",   // ← public: no auth required
  "/products(.*)",    // ← public
  "/orders(.*)",      // ← public
  "/settings(.*)",    // ← public
  // ...all admin pages
]);
```

`auth.protect()` only fires for routes NOT in the list — i.e. almost nothing. Any visitor can open `/dashboard` without signing in.

**Secondary bug:** the sign-in page's Google/GitHub buttons redirect to `/sign-in?strategy=...` — a route that doesn't exist in the admin app (it's the storefront path). Should be `/auth/sign-in?strategy=...`.

---

## 2. Fix

### 2a. Restrict `isPublicRoute` in `apps/admin/src/proxy.ts`

Keep **only** truly public routes:

```ts
const isPublicRoute = createRouteMatcher([
  "/auth/sign-in(.*)",
  "/api/webhooks/(.*)",
]);
```

Everything else (including `/`) requires `auth.protect()`. Unauthenticated users get redirected to Clerk's sign-in (which lands on `/auth/sign-in`).

### 2b. Fix the sign-in redirect path

In `apps/admin/src/app/auth/sign-in/page.tsx`, change:
```ts
window.location.href = `/sign-in?strategy=${strategy}`;
```
to:
```ts
window.location.href = `/auth/sign-in?strategy=${strategy}`;
```

### 2c. Verify the auth redirect loop

- `auth.protect()` without a session redirects to the Clerk-hosted sign-in. Confirm the `signInUrl`/`afterSignInUrl` are configured so the user returns to the admin dashboard (`/dashboard` or `/`).
- The root `/` route — decide whether it should redirect to `/dashboard` when authed, or stay as the login landing. Recommend `/` redirects to `/dashboard` (protected).

---

## 3. Security considerations

- **API calls** (`request()` in `client.ts`) already attach the Clerk bearer token via `getAuthToken()` — so once the proxy requires auth, the backend's `get_current_tenant_user` dependency works correctly.
- **Backend defense-in-depth:** the backend endpoints already require `X-Tenant-ID` / Clerk tokens. This proxy fix closes the frontend hole; backend enforcement is unaffected.
- **No CSRF regression:** `auth.protect()` is the standard Clerk server-side gate; it doesn't change cookie handling.

---

## 4. Verification

1. Unauthenticated visit to `/dashboard` → redirected to Clerk sign-in (no longer renders admin UI).
2. Sign in → lands on admin dashboard.
3. Sign out → cannot reach `/orders`, `/settings`, etc. without re-auth.
4. Backend tests unaffected (proxy is frontend-only).
5. `pnpm build` + `tsc` clean for admin.
