# Stack Context: Turborepo + Clerk + FastAPI

- **Architecture:** Shopify Turborepo. Frontend is `apps/storefront` (Next.js App Router). Backend is `services/backend-api` (FastAPI).
- **Auth Provider:** Clerk.
- **Frontend Auth:** `@clerk/nextjs`. Uses Middleware for route protection and `<ClerkProvider>` in layout.
- **Backend Management:** `clerk-backend-api`. Used ONLY for server-side management (e.g., creating users, fetching orgs).
- **Backend Auth (JWT):** `clerk-backend-api` does NOT have a built-in FastAPI auth middleware. You MUST use `PyJWT` and `httpx` to verify Clerk JWTs against Clerk's JWKS endpoint.
- **Backend Sync (Webhooks):** Clerk uses `svix` for webhooks. Use the `svix` Python package to verify webhook signatures and sync `user.created`, `user.updated`, and `user.deleted` events to the local database.
- **Env Vars:**
  - Frontend (`apps/web/.env.local`): `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
  - Backend (`apps/api/.env`): `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
