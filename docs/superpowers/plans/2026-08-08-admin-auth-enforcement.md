# Implementation Plan: Admin Auth Enforcement (P0)

**Branch:** `fix/admin-auth-enforcement`

**Spec:** `docs/superpowers/specs/2026-08-08-admin-auth-enforcement.md`

---

## Step 1 — Restrict `isPublicRoute` in `apps/admin/src/proxy.ts`

- Remove all admin page entries from `isPublicRoute`
- Keep only:
  ```ts
  const isPublicRoute = createRouteMatcher([
    "/auth/sign-in(.*)",
    "/api/webhooks/(.*)",
  ]);
  ```
- `auth.protect()` now gates `/`, `/dashboard`, `/orders`, `/settings`, `/products`, and every other route (deny-by-default).

**Files:**
- `apps/admin/src/proxy.ts`

---

## Step 2 — Fix OAuth redirect path

- In `apps/admin/src/app/auth/sign-in/page.tsx`, change:
  ```ts
  window.location.href = `/sign-in?strategy=${strategy}`;
  ```
  to:
  ```ts
  window.location.href = `/auth/sign-in?strategy=${strategy}`;
  ```

**Files:**
- `apps/admin/src/app/auth/sign-in/page.tsx`

---

## Step 3 — Verify redirect config (Clerk provider)

- Confirm `ClerkProviderPinned` in `apps/admin/src/app/layout.tsx` allows the post-auth return to `/dashboard`.
- If needed, add `afterSignInUrl="/dashboard"` / `afterSignOutUrl="/auth/sign-in"` to the provider.

**Files:**
- `apps/admin/src/app/layout.tsx` (if needed)

---

## Step 4 — Validation

1. `pnpm build` + `tsc --noEmit` clean for admin
2. Incognito → `/dashboard` → redirected to `/auth/sign-in`
3. Sign in → lands on dashboard
4. Sign out → protected routes redirect to sign-in

---

## Step 5 — Commit & PR

- Commit on `fix/admin-auth-enforcement`, push, open PR against `main`
- PR body references the spec + security rationale
