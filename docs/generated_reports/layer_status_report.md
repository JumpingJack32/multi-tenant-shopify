# Multi-Tenant Shopify Platform — Layer Status Report

> **Generated:** 2026-06-26
> **Scope:** Backend (FastAPI, SQLModel, RLS, tenants), Admin Frontend (Next.js 16), Storefront (Next.js 16)
> **Overall Health:** ⚠️ Needs significant work before production readiness

---

## Executive Summary

| Layer | Status | Completeness | Critical Issues |
|-------|--------|-------------|-----------------|
| **Backend** | In Progress | ~55% | 1 critical, 3 high |
| **Admin Frontend** | In Progress | ~40% | 3 critical, 4 high |
| **Storefront** | Not Ready | ~15% | 3 critical, 2 high |

**StoreUserLink Junction Table:** ❌ **Does not exist.** No M:N relationship between Tenant and User is implemented. See Backend section for recommended schema.

---

## 1. Backend Layer (FastAPI, SQLModel, RLS, Tenants)

**File:** `services/backend-api/src/` + `packages/tenant-orm/`

### ✅ DONE

| Feature | Evidence |
|---------|----------|
| FastAPI app setup with lifespan | `main.py:1-90` |
| SQLModel base model | `orm/base.py` |
| ORM models (Tenant, Product, Order, TenantUser) | `orm/models/` |
| Pydantic schemas | `orm/schemas/` |
| Database engine + session factory | `database.py` |
| ContextVar-based tenant isolation | `core/tenant_isolation.py` |
| Clerk JWKS key management | `core/clerk_jwks.py` |
| Password hashing (bcrypt) | `core/security.py` |
| Tenant CRUD routes | `routes/tenants.py` |
| Product CRUD routes | `routes/products.py` |
| Order CRUD routes | `routes/orders.py` |
| Auth routes | `routes/auth.py`, `routes/admin_auth.py` |
| Svix + Shopify webhook routes | `routes/webhooks.py` |
| Tenant migration utilities | `utils/tenant_migration.py` |
| Robust tenant middleware (unused) | `middleware/tenant_middleware.py` |
| Pydantic settings config | `core/config.py` |

### 🔄 IN PROGRESS

| Feature | What's Missing |
|---------|---------------|
| **Webhook signature verification** | Svix signature check is a TODO at `webhooks.py:29` |
| **Shopify HMAC verification** | Exists but relies on plaintext env var for app secret |
| **Clerk JWT audience/issuer validation** | `clerk_jwks.py` only validates signature, not claims |
| **JWKS cache expiry** | `_jwks_cache` never expires — stale keys after rotation |
| **Admin bypass audit trail** | `_admin_tenant_ids` set exists with no logging |
| **Rate limiting** | No middleware on any public endpoint |
| **Background task tenant isolation** | No mechanism to prevent stale context in async tasks |
| **Raw SQL scoping documentation** | Developer must manually scope tenant_id in raw queries |

### ❌ NOT STARTED

| Feature | Evidence |
|---------|----------|
| **StoreUserLink junction table** | No M:N relationship between Tenant and User exists |
| **Store/User link API routes** | No `routes/stores.py` or similar |
| **Admin bypass audit logging** | No logging infrastructure for admin queries |
| **Test suite** | Zero `.test.py` files in entire backend |
| **API documentation** | No OpenAPI/Swagger customization |

### 🏗 Architectural Concerns

1. **CORS misconfiguration** — `main.py:49-50`: `allow_origins=["*"]` + `allow_credentials=True` is invalid. Breaks authenticated cross-origin requests.

2. **Middleware redundancy** — `middleware/tenant_middleware.py` contains a superior implementation (error handling, fallback resolution, logging) that is **never mounted**. The inline middleware at `main.py:75-78` lacks error handling.

3. **Default tenant UUID** — `dependencies.py:13`: If tenant extraction fails silently, queries default to `UUID("00000000-0000-0000-0000-000000000000")`. Should default to `None` and raise explicitly.

4. **Event listener gaps** — `tenant_isolation.py`: `append_select_where_clause` filters SELECT queries but may not cover subqueries with joins, raw SQL, or `INSERT ... SELECT` patterns.

### 🔒 Security Concerns

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | **Svix webhook signature verification missing** | CRITICAL | `routes/webhooks.py:29` |
| 2 | **Clerk JWT missing audience/issuer validation** | HIGH | `core/clerk_jwks.py` |
| 3 | **Admin bypass without audit trail** | HIGH | `core/tenant_isolation.py` |
| 4 | **CORS wildcard + credentials conflict** | HIGH | `main.py:49-50` |
| 5 | **JWKS cache no expiry** | MEDIUM | `core/clerk_jwks.py` |
| 6 | **Hardcoded default tenant UUID** | MEDIUM | `dependencies.py:13` |
| 7 | **No rate limiting on public endpoints** | MEDIUM | All public routes |
| 8 | **SQL injection risk in raw migrations** | MEDIUM | `utils/tenant_migration.py` |

### 🔗 StoreUserLink Junction Table

**Status:** ❌ Not implemented

**Recommended Schema:**

```python
class StoreUserLink(BaseModel):
    __tablename__ = "store_user_links"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    tenant_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenant_users.id", ondelete="CASCADE"), nullable=False
    )
    store_id: Mapped[str] = mapped_column(index=True, nullable=False)
    store_role: Mapped[str] = mapped_column(nullable=False)  # "owner", "admin", "staff"
    linked_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    linked_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tenant_users.id"))
    is_active: Mapped[bool] = mapped_column(default=True)

    __table_args__ = (
        UniqueConstraint("tenant_user_id", "store_id", name="uq_user_store"),
    )
```

In a production environment, it is best practice to separate your models into:

1. A Base Schema: Shared fields (columns, validation).
2. A Database Table: The actual table with constraints and relationships.
3. API Schemas: Data structures for reading (Public) or creating (Create) data via an API.

### Join Table — StoreUserLink must come before Tenant + User

```python
import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlmodel import Field, Relationship, SQLModel, UniqueConstraint


# 1. Define an Enum for roles to prevent string typos
class StoreRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    STAFF = "staff"


# 2. Shared Fields (Pydantic & SQLModel hybrid)
class StoreUserLinkBase(SQLModel):
    store_id: str = Field(index=True, nullable=False)
    store_role: StoreRole = Field(default=StoreRole.STAFF, index=True)
    is_active: bool = Field(default=True)


# 3. API Schema: For creating a link (What the frontend sends)
class StoreUserLinkCreate(StoreUserLinkBase):
    tenant_user_id: uuid.UUID # <-- map this to existing tenant_user_id


# 4. API Schema: For returning data (What the API responds with)
class StoreUserLinkPublic(StoreUserLinkBase):
    id: uuid.UUID
    tenant_user_id: uuid.UUID
    linked_at: datetime
    linked_by: uuid.UUID | None 


# 5. Database Table Definition
class StoreUserLink(StoreUserLinkBase, table=True):
    __tablename__ = "store_user_links"
    __table_args__ = (
        UniqueConstraint("tenant_user_id", "store_id", name="uq_user_store"),
    )

    # Primary Key
    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
        nullable=False,
    )

    # Foreign Keys
    tenant_user_id: uuid.UUID = Field(
        foreign_key="tenant_users.id", 
        ondelete="CASCADE", 
        nullable=False
    )
    
    # Audit Trails (Using timezone-aware UTC default)
    linked_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    linked_by: uuid.UUID | None = Field(
        default=None, 
        foreign_key="tenant_users.id", 
        ondelete="SET NULL"
    )

    # SA Relationships (Optional, but highly recommended for ORM querying)
    # sa_relationship_kwargs handles ambiguous multiple FKs to the same table
    tenant_user: "TenantUser" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[StoreUserLink.tenant_user_id]"}
    )
    creator: "TenantUser" = Relationship(
        sa_relationship_kwargs={"foreign_keys": "[StoreUserLink.linked_by]"}
    )
```

Also, while `UserRole` and `StoreRole` look nearly identical and share similar string values (`"owner"`, `"admin"`, `"staff"`), they serve two completely different conceptual purposes in a multi-tenant or multi-store architecture.

```python
class StoreRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    STAFF = "staff"
```

```python
class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"

```

Here is the breakdown of why you have both, how they differ, and why separating them is a critical design pattern.

---

## The Conceptual Difference

The easiest way to understand the difference is to look at **scope**:

### 1. `UserRole` (Global / Tenant Scope)

This role defines a user’s permissions across the **entire platform or organization (Tenant)**. It dictates what a user can do at the highest account level.

* **OWNER:** The person who pays the bill for the entire platform account. They can delete the whole organization, view billing details, and create new stores.
* **ADMIN:** A global administrator who can manage all system settings, invite new global users, and oversee the whole system, but maybe cannot touch billing.
* **MANAGER / STAFF:** Global designations that define their baseline capabilities across the organization.

### 2. `StoreRole` (Local / Contextual Scope)

This role defines a user's permissions **only within a specific physical or digital store**. A user only gets a `StoreRole` when they are explicitly linked to a store via your `StoreUserLink` table.

* **OWNER / ADMIN:** The manager or supervisor *of that specific branch*. They can change store hours, manage inventory for that store, and view that store's specific sales reports.
* **STAFF:** A cashier or floor worker who can only ring up sales at *that specific location*.

---

## Why Separate Them? (The Real-World Scenario)

If you combine these into a single enum, your system loses flexibility. Separating them allows for **contextual permissions**, which is exactly how real-world businesses operate.

### Example Scenario: The Regional Franchise

Imagine a company that owns 5 retail stores.

* **Alice** is hired as a **Regional Manager** for the whole company.
* Her global `UserRole` is `ADMIN`.
* Because she oversees everything, she has high-level permissions across the board.

* **Bob** is a local employee.
* His global `UserRole` is `STAFF`.
* However, Bob is incredibly trustworthy, so the company makes him the **Store Manager of Store A**, but just a regular **Shift Worker at Store B**.

Because you separated the roles, your database can easily represent Bob's complex permissions:

| User | Table / Context | Associated Target | Assigned Role | What it means |
| --- | --- | --- | --- | --- |
| **Bob** | `User` table (Global) | *Entire Account* | `UserRole.STAFF` | Bob is a standard employee globally. |
| **Bob** | `StoreUserLink` table | **Store A** | `StoreRole.ADMIN` | At Store A, Bob can change schedules and open the safe. |
| **Bob** | `StoreUserLink` table | **Store B** | `StoreRole.STAFF` | At Store B, Bob is just a cashier and can't access the safe. |

---

## Technical Benefits of `(str, Enum)`

By inheriting from both `str` and `Enum`, you are implementing a **String Enum**. This gives you two major production advantages:

1. **Type Safety & Validation:** In your Python code, you can't accidentally type `role = "staf"` (with a typo). Your IDE will autocomplete `StoreRole.STAFF`, and Pydantic will reject invalid strings automatically at the API gateway.
2. **Database Serialization:** Plain Python enums turn into obscure integers or custom database types. A `str` enum saves cleanly into PostgreSQL or MySQL as a readable string (`"owner"`, `"admin"`), making your raw database tables easy to read and audit during debugging.

---

## 2. Admin Frontend Layer (Next.js 16 + Clerk + TanStack Query)

**File:** `apps/admin/src/`

### ✅ DONE

| Feature | Evidence |
|---------|----------|
| Clerk v7 sign-in page | `app/auth/sign-in/page.tsx` |
| Product listing page | `app/(app)/products/page.tsx` |
| Product table with sorting | `components/products/product-table.tsx` |
| Product form (create/edit) | `components/products/product-form.tsx` |
| Product delete dialog | `components/products/product-delete-dialog.tsx` |
| Product drawer | `components/products/product-drawer.tsx` |
| Search toolbar | `components/products/table-toolbar.tsx` |
| API client layer | `lib/api/client.ts` |
| Product service layer | `features/products/api/products-service.ts` |
| RBAC context (client-side) | `contexts/rbac-context.tsx` |
| Tenant context (stub) | `contexts/tenant-context.tsx` |
| App shell + sidebar layout | `components/layout/app-shell.tsx`, `sidebar.tsx` |
| Base UI re-exports | `packages/ui/src/styles/base-ui.ts` |
| TanStack Query setup | `components/layout/app-shell.tsx` |
| Shared utilities (cn, formatCurrency) | `packages/shared-utils/` |

### 🔄 IN PROGRESS

| Feature | What's Missing |
|---------|---------------|
| **Route protection middleware** | No `middleware.ts` — zero routes are protected server-side |
| **Tenant context fetch logic** | `tenant-context.tsx:37-78` entirely commented out — tenant switcher is empty |
| **Dashboard page** | Sidebar links to `/` but `app/(app)/dashboard/` does not exist |
| **Orders page** | Sidebar links to `/orders` but `app/(app)/orders/` does not exist |
| **Settings page** | Sidebar links to `/settings` but `app/(app)/settings/` does not exist |
| **URL-synced pagination** | `page` and `pageSize` are local state, not in URL |
| **Form data typing** | `product-form.tsx:12` uses `any` for form data |

### ❌ NOT STARTED

| Feature | Evidence |
|---------|----------|
| **Error boundaries** | No error boundaries in any layout |
| **Server-side auth verification** | RBAC is client-only — altered session tokens bypass all checks |
| **Test suite** | Zero `.test.ts`/`.spec.ts` files |
| **Loading states** | No skeleton loaders or spinners |
| **Toast/notification system** | No feedback on success/error |
| **Dashboard analytics** | No dashboard page exists |
| **Order management** | No orders UI (backend routes exist) |
| **Settings pages** | No settings UI (backend routes may exist) |

### 🏗 Architectural Concerns

1. **No route protection middleware** — CRITICAL. Any user can navigate to `/products`, `/settings`, `/orders`. The only "protection" is a client-side `can("update")` check on one button.

2. **Dead navigation links** — Sidebar links to 3 non-existent pages (`/`, `/orders`, `/settings`). Clicking any produces a 404.

3. **Singleton QueryClient outside React tree** — `app-shell.tsx:9`: Module-level `new QueryClient()` is an anti-pattern. Should be created inside the component or memoized with `useMemo`.

4. **Duplicate data fetching layer** — `api/client.ts` provides a clean interface, but `products-service.ts` wraps it again with redundant `getTenantId()` calls and unsafe type casts (`result as Product[]`).

5. **Local state + TanStack Query conflict** — `products/page.tsx:23-25`: Search, page, and pageSize are local state. `pageSize` is immutable (no setter). `onPageSizeChange` is a no-op.

6. **Stale/dead files** — `drawer copy.tsx` and `sidebar copy.tsx` contain syntax errors and should be deleted.

### 🔒 Security Concerns

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | **Client-only RBAC** | CRITICAL | `contexts/rbac-context.tsx` — altered session tokens bypass all checks |
| 2 | **No route protection middleware** | CRITICAL | No `middleware.ts` exists |
| 3 | **Auth token silently dropped on missing Clerk** | HIGH | `lib/api/client.ts:14` — returns `null` instead of throwing |
| 4 | **Unvalidated Supabase credentials** | HIGH | `hooks/use-tenant.ts:9-10` — `!` assertions on env vars |
| 5 | **Hardcoded API fallback** | MEDIUM | `lib/api/client.ts:3` — silently falls back to localhost |
| 6 | **Unsafe type casts** | MEDIUM | `products-service.ts:37`, `products/page.tsx:78` — `as any` |
| 7 | **Hardcoded status colors** | LOW | `product-table.tsx:76-84` — not theme-aware |

### 🐛 TypeScript Status

| Error | File | Line |
|-------|------|------|
| `ignoreDeprecations: "6.0"` is invalid | `tsconfig.json` | 4 |
| **TypeScript checking is completely broken** | | |

**Fix:** Change `"ignoreDeprecations": "6.0"` to `"ignoreDeprecations": ["6.0"]` or remove it.

---

## 3. Storefront Layer (Next.js 16 + Clerk + Supabase)

**File:** `apps/storefront/src/`

### ✅ DONE

| Feature | Evidence |
|---------|----------|
| Root layout with ClerkProvider | `app/layout.tsx:3,22` |
| Dynamic `[tenant]` route group | `app/[tenant]/page.tsx` |
| Domain-based tenant resolution | `lib/tenant-resolver.ts:3-7` |
| ProductCard component | `components/storefront/product-card.tsx:9` |
| Cart Zustand store | `hooks/use-cart.ts:17` |
| Cart component (add/remove/clear) | `components/storefront/cart.tsx:5` |
| Button component (from @repo/ui) | `packages/ui/src/components/ui/button.tsx` |
| cn utility for className merging | `lib/utils.ts:1` |
| formatCurrency utility | `packages/shared-utils/src/format.ts:3` |
| Clerk auth middleware (stub) | `proxy.ts:11` |

### 🔄 IN PROGRESS

| Feature | What's Missing |
|---------|---------------|
| **Tenant context validation** | `[tenant]/layout.tsx:8-10` receives params but never uses them |
| **QueryClientProvider** | Commented out in `layout.tsx:25-27` |
| **Store config/context** | No `StoreContext` — no way to know store name, logo, theme, currency |
| **Tenant client functionality** | `createTenantClient` sets `tenantId: ""` — non-functional |
| **Product status type alignment** | DB uses `'active'`, TS types use `'published'` — mismatch |

### ❌ NOT STARTED

| Feature | Evidence |
|---------|----------|
| **(store) route group** | Does not exist — no organized storefront pages |
| **Shopify Storefront API integration** | Zero Shopify SDK usage |
| **Product sync logic** | Products are manually entered into Supabase |
| **Product detail page** | No `/[tenant]/[product]` route |
| **Cart-to-checkout flow** | Cart is ephemeral Zustand store with no checkout |
| **Header/Footer/Navigation** | No layout components |
| **Auth UI** | No login/register/reset pages |
| **Search/filter/sort** | No product discovery features |
| **Pagination/infinite scroll** | No pagination logic |
| **Toast/notification system** | No feedback UI |
| **Loading/skeleton states** | No loading UI |
| **Test suite** | Zero test files |
| **Shopify webhooks** | No order/product update webhooks |
| **Multi-currency support** | No currency configuration |
| **Locale/i18n** | No internationalization |

### 🏗 Architectural Concerns

1. **No middleware for tenant resolution** — `proxy.ts` exports Clerk middleware but Next.js requires `middleware.ts`. Auth is completely bypassed.

2. **Supabase anon key exposed** — `app/[tenant]/page.tsx:11`: `NEXT_PUBLIC_SUPABASE_ANON_KEY!` with non-null assertion — will crash if env var is missing.

3. **Tenant client is non-functional** — `createTenantClient` sets `tenantId: ""` and `withTenantScope()` is never called. RLS policies reference `current_setting('app.current_tenant_id')` but nothing sets this PostgreSQL session variable.

4. **Type mismatch** — DB schema uses `'draft' | 'active' | 'archived'` but TS types use `'draft' | 'published' | 'archived'`.

5. **QueryClient instantiated but disabled** — `layout.tsx:25-27`: `QueryClientProvider` is commented out, making all TanStack Query infrastructure useless.

6. **Cart has no persistence or checkout** — Zustand cart is ephemeral (lost on refresh), no Shopify checkout connection.

7. **No error handling** — `app/[tenant]/page.tsx:14`: Supabase query has no try/catch, no error UI, no loading states.

8. **Unused dependencies** — `@repo/codegen`, `@hookform/resolvers`, `react-hook-form`, `zod` are in `package.json` but unused.

### 🔒 Security Concerns

| # | Issue | Severity | File |
|---|-------|----------|------|
| 1 | **Auth middleware not wired up** | CRITICAL | `proxy.ts` exists but no `middleware.ts` |
| 2 | **Supabase anon key in client-accessible code** | HIGH | `app/[tenant]/page.tsx:11` |
| 3 | **No RLS enforcement** | HIGH | `withTenantScope()` never called — direct queries bypass tenant isolation |
| 4 | **Hardcoded credentials in .env** | MEDIUM | `.env:8-9` contains test Clerk keys (should be gitignored) |
| 5 | **No input validation on tenant slug** | MEDIUM | `[tenant]` accepts any string with no DB validation |

### 🐛 TypeScript Status

| Error | File | Line |
|-------|------|------|
| `ignoreDeprecations: "6.0"` is invalid | `tsconfig.json` | 7 |

**Fix:** Change `"ignoreDeprecations": "6.0"` to `"ignoreDeprecations": ["6.0"]` or remove it.

---

## Priority Matrix

### 🔴 Critical (Fix Immediately)

| # | Issue | Layer | Effort |
|---|-------|-------|--------|
| 1 | Svix webhook signature verification missing | Backend | 2h |
| 2 | No route protection middleware (admin) | Admin | 3h |
| 3 | Client-only RBAC (admin) | Admin | 4h |
| 4 | Auth middleware not wired up (storefront) | Storefront | 2h |
| 5 | TypeScript checking broken (all projects) | All | 30m |

### 🟡 High (Fix This Sprint)

| # | Issue | Layer | Effort |
|---|-------|-------|--------|
| 6 | Clerk JWT missing audience/issuer validation | Backend | 2h |
| 7 | Admin bypass without audit trail | Backend | 3h |
| 8 | CORS wildcard + credentials conflict | Backend | 1h |
| 9 | Tenant context fetch logic commented out | Admin | 4h |
| 10 | Dashboard/Orders/Settings pages missing | Admin | 8h |
| 11 | Tenant client non-functional (storefront) | Storefront | 4h |
| 12 | No RLS enforcement (storefront) | Storefront | 3h |
| 13 | StoreUserLink junction table missing | Backend | 6h |

### 🟢 Medium (Fix When Possible)

| # | Issue | Layer | Effort |
|---|-------|-------|--------|
| 14 | JWKS cache no expiry | Backend | 1h |
| 15 | No rate limiting | Backend | 3h |
| 16 | Dead middleware code (unused) | Backend | 1h |
| 17 | Singleton QueryClient outside React tree | Admin | 1h |
| 18 | Stale "copy" files with syntax errors | Admin | 30m |
| 19 | Cart has no persistence | Storefront | 4h |
| 20 | No error boundaries | Admin | 2h |

### 🔵 Low (Nice to Have)

| # | Issue | Layer | Effort |
|---|-------|-------|--------|
| 21 | No test suite (all layers) | All | 20h+ |
| 22 | Unused dependencies | Storefront | 1h |
| 23 | Hardcoded status colors | Admin | 1h |
| 24 | No loading states | Storefront | 3h |

---

## Estimated Total Effort to Production Readiness

| Category | Hours |
|----------|-------|
| Critical fixes | ~10h |
| High priority | ~33h |
| Medium priority | ~13h |
| Low priority | ~25h+ |
| **Total** | **~81h** |

---

## Recommendations

1. **Fix TypeScript configs first** — All 3 projects have broken `ignoreDeprecations` settings. This blocks all type checking.

2. **Implement auth middleware for both frontends** — No routes are protected server-side. This is the single biggest security gap.

3. **Fix backend webhook signatures** — Unsigned webhooks allow payload forgery (fake orders, inventory manipulation).

4. **Implement StoreUserLink junction table** — Required for multi-store ownership tracking and cross-store permissions.

5. **Fix tenant context in admin** — The entire multi-tenant switching mechanism is non-functional (commented out).

6. **Functionalize storefront tenant client** — `createTenantClient` with empty `tenantId` and unused `withTenantScope()` means RLS is never enforced.

7. **Start writing tests** — Zero test coverage across the entire monorepo. Begin with backend integration tests for tenant isolation.
