# Todos

[•] Phase 0: Fix ignoreDeprecations syntax in all tsconfig.json files
[ ] Phase 0: Verify turbo.json pipeline includes typecheck and build with proper dependsOn
[ ] Phase 0: Add root-level turbo run typecheck script to package.json
[ ] Phase 0: Run turbo run typecheck to confirm zero errors
[ ] Phase 1.1: Create @repo/auth package with package.json, tsconfig.json, src/index.ts
[ ] Phase 1.1: Extract JWT create/decode/verify logic to @repo/auth
[ ] Phase 1.1: Implement Clerk token verification utilities with JWKS cache
[ ] Phase 1.1: Export createClerkMiddleware() function
[ ] Phase 1.2: Create @repo/middleware package with package.json, tsconfig.json, src/index.ts
[ ] Phase 1.2: Implement webhook signature verification (Svix + Shopify)
[ ] Phase 1.2: Implement rate limiting utilities
[ ] Phase 1.2: Implement CORS configuration helper
[ ] Phase 2.1: Implement Svix signature verification in webhooks.py
[ ] Phase 2.1: Add Clerk JWT audience/issuer validation
[ ] Phase 2.1: Fix CORS wildcard + credentials conflict
[ ] Phase 2.1: Add JWKS cache TTL expiry
[ ] Phase 2.1: Implement admin bypass audit logging
[ ] Phase 2.1: Replace hardcoded default tenant UUID with None + explicit raise
[ ] Phase 2.2: Mount TenantMiddleware from middleware/tenant_middleware.py
[ ] Phase 2.2: Fix event listener gaps in append_select_where_clause
[ ] Phase 2.2: Add background task tenant isolation mechanism
[ ] Phase 2.2: Document raw SQL scoping requirements
[ ] Phase 2.3: Create StoreUserLink model with M:N relationship
[ ] Phase 2.3: Create StoreRole enum (OWNER, ADMIN, STAFF)
[ ] Phase 2.3: Create Pydantic schemas for StoreUserLink
[ ] Phase 2.3: Create API routes for stores CRUD + link/unlink
[ ] Phase 2.3: Add database migration for store_user_links table
[ ] Phase 3.1: Create middleware.ts for admin with server-side route protection
[ ] Phase 3.1: Implement server-side auth verification with RBAC
[ ] Phase 3.1: Fix API client token handling
[ ] Phase 3.1: Validate Supabase credentials properly
[ ] Phase 3.2: Fix singleton QueryClient anti-pattern in app-shell.tsx
[ ] Phase 3.2: Remove duplicate data fetching layer
[ ] Phase 3.2: Fix product form typing (replace any with ProductFormData)
[ ] Phase 3.2: Delete stale copy files (drawer copy.tsx, sidebar copy.tsx)
[ ] Phase 3.3: Create Dashboard page
[ ] Phase 3.3: Create Orders page
[ ] Phase 3.3: Create Settings page
[ ] Phase 3.3: Fix tenant context fetch logic
[ ] Phase 3.3: Implement URL-synced pagination
[ ] Phase 3.4: Add error boundaries for app shell and route groups
[ ] Phase 3.4: Add loading states with skeleton loaders
[ ] Phase 3.4: Add toast/notification system
[ ] Phase 3.4: Fix pagination state (pageSize mutable, onPageSizeChange wired)
[ ] Phase 4.1: Create middleware.ts for storefront with Clerk auth
[ ] Phase 4.1: Validate tenant slug on entry
[ ] Phase 4.1: Remove hardcoded Supabase anon key
[ ] Phase 4.2: Functionalize createTenantClient with proper tenantId and withTenantScope()
[ ] Phase 4.2: Enable QueryClientProvider in layout.tsx
[ ] Phase 4.2: Create StoreContext for store config
[ ] Phase 4.2: Fix product status type mismatch
[ ] Phase 4.3: Persist cart to localStorage with persist middleware
[ ] Phase 4.3: Create checkout flow connected to Shopify/Backend
[ ] Phase 4.3: Add cart persistence across sessions
[ ] Phase 4.4: Create (store) route group for storefront pages
[ ] Phase 4.4: Create product detail page
[ ] Phase 4.4: Add header/footer/navigation layout components
[ ] Phase 4.4: Add search/filter/sort for product discovery
[ ] Phase 4.4: Add loading/skeleton states
[ ] Phase 5.1: Apply rate limiting to all public endpoints
[ ] Phase 5.1: Add rate limiting to Next.js API routes
[ ] Phase 5.1: Clean up unused dependencies
[ ] Phase 5.2: Install and configure Playwright
[ ] Phase 5.2: Create admin E2E tests
[ ] Phase 5.2: Create storefront E2E tests
[ ] Phase 5.2: Add CI pipeline for E2E tests
[ ] Phase 5.3: Add multi-tenant error boundaries
[ ] Phase 5.3: Add global error handling middleware
[ ] Phase 5.3: Add API documentation (Swagger/OpenAPI)
[ ] Phase 5.3: Final cleanup (dead code, unused imports, console logs)
