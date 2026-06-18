---
name: multi-tenant-platform
description: A Turborepo monorepo powering a multi-tenant Shopify-style SaaS platform, using a Next.js frontend ecosystem (apps/admin and apps/storefront) and a high-performance FastAPI (Python) backend (services/backend-api) and (packages/*) a shared workspace packages and auto-generated artifacts. The architecture enforces strict multi-tenant data isolation at the database level via PostgreSQL Row-Level Security (RLS) linked to a unified tenant_id on all SQLModel structures
metadata:
  author: zockbolt
  version: "1.0.0"
---

# AGENTS.md — Repository Guidance & Constraints

This file outlines strict architectural boundaries, explicit developer loops, and framework quirks for AI agents operating in this repository. Verify everything before execution.

## Quick Reference (Read This First)

**Stack:** Next.js 16.2 + Python 3.14 + FastAPI + Turborepo + PostgreSQL RLS + Clerk Auth + uv  
**Multi-Tenancy:** Enforced via `tenant_id` on all models + Row-Level Security  
**Critical Rule:** Never write raw DB queries in `apps/` or service routes. Use `packages/tenant-orm` (TypeScript) and `services/backend-api/src/orm` (Python).  
**Python Commands:** Always use `uv run <command>`. Never use `pip` or direct Python invocation.  
**Verification:** Always run `turbo run lint` → `turbo run typecheck` → `turbo run test`  
**Secrets:** Doppler only. Never `.env` files.

---

## 1. Monorepo Topology & Package Boundaries

This project is a multi-tenant Shopify-style SaaS application managed with **Turborepo**. Never cross-contaminate package boundaries.

### Core Applications (`/`)

* `apps/admin/src/app/...` -> Next.js control panel for tenant/platform management.
* `apps/storefront/src/app/...` -> Next.js dynamic e-commerce storefront engine.
* `services/backend-api/src/...` -> FastAPI / Python backend engine. **The Python ORM and SQLModel definitions reside in `services/backend-api/src/orm`.**

### Shared Workspace Packages (`packages/*`)

* `packages/codegen` -> Automatically generated types and clients. Do not modify artifacts here by hand.
* `packages/db` -> Raw migration scripts and schema setups.
* `packages/tenant-orm` -> **All TypeScript multi-tenant data access, client wrappers, and Zod schema definitions go here.** (Strictly TypeScript/JavaScript).
* `packages/ui` -> Design tokens, **Tailwind CSS 4.x** config, and **shadcn/ui** / **Base UI** primitives.
* `packages/shared-utils` -> Common helper modules shared across workspaces.
* `packages/eslint-config` & `packages/typescript-config` -> Tooling standards.

* **Secret Management:** Credentials must be context-injected via **Doppler**. Never manually hardcode or leak credentials into any workspace file.

---

## 2. Framework Syntax Contracts & Constraints

### Zod & Type Synchronization (The Polyglot Data Bridge)

* **Source of Truth:** The Python backend/ORM tier (`services/backend-api/src/orm`) is the absolute source of truth for all schemas, model properties, and data constraints.
* **The Generation Loop:** Frontends must never manually write standalone Zod form schemas or TypeScript typings that duplicate backend structures. All data structures, validation rules, and fetching clients must flow down from the backend using `@hey-api/openapi-ts` with `@hey-api/plugin-zod` compiled into `packages/codegen`.
* **Frontend Form Binding:** When handling user input validation (e.g., in React Hook Form), use the auto-generated schemas exported from `@repo/codegen` via `zodResolver(ProductCreateSchema)`. Use `.pipe()` or sub-object selections only to decorate frontend-specific UI states.

### Webhooks & Async Events

* **Webhook Verification:** Every incoming webhook endpoint (e.g., stripe, third-party apps, internal service events) MUST use **Svix** for cryptographic payload verification before processing. Reject unsigned or invalid payloads immediately.
* **Background Processing:** Long-running operations triggered by events (e.g., image processing, store provisioning) must be handed off to an async task runner. Do not block the main FastAPI request thread.

### Tenant Isolation & Tenant-Aware Routing (Frontend Tier)

* **Tenant Resolution Contract:** The `packages/tenant-orm` package owns runtime tenant resolution via `tenant-resolver.ts`. It must automatically parse incoming requests (Host headers, subdomains, or validated Clerk token context claims) to resolve the target `tenant_id`.

* **Automatic Tenant Injection:** You must never instantiate raw, unconfigured Supabase database clients directly inside `apps/admin` or `apps/storefront`. All data operations must go through the client exported by `@repo/tenant-orm/client`, which transparently intercepts and appends the resolved `tenant_id` state query bounds or context variables to guarantee complete isolation.

### Frontend (React 19.x / Next.js / Tailwind 4.x / Clerk Auth)

**Form Submissions:** Interactive event handlers managing form submissions must use native SubmitEvent hooks or standard React 19 typed form actions (`<form action={action}>`) instead of legacy React.FormEvent preventDefault boilerplate where possible. Prefer Server Actions for form mutations where applicable, utilizing the useActionState hook for pending states and validation feedback.

* **Clerk Authentication (v7.4.2+):** Conditional wrapper rendering structures (such as `<SignedIn>` or `<SignedOut>`) are deprecated. For UI state visibility, use the unified `<Show when="signed-in">...</Show>` or `<Show when="signed-out">...</Show>` wrapper components. Note that for sensitive routes or data gating, you must still enforce authentication layout-wide via Next.js Middleware or server-side layout token validation pipelines; do not rely on visual client wrappers for absolute security isolation.

* **Class Merging:** Always use the `cn()` utility (from `packages/shared-utils` or `packages/ui`) for conditional Tailwind classes. Never use string concatenation or `classnames` directly.
* **State Management:**
  * **Server State:** Use **TanStack Query (React Query)** for all data fetching and caching.
  * **Client State:** Use **Zustand** for local UI state. Avoid Redux.
  * **Server Components:** Default to React Server Components (RSC). Only add `'use client'` when utilizing hooks, browser APIs, or event listeners.

### Backend & Data Isolation (Python / SQLModel / FastAPI)

* **Data Isolation Engine:** Multi-tenancy is protected by PostgreSQL (Supabase) **Row-Level Security (RLS)**.
* **Model Structural Requirements:** Every data model mapped via **SQLModel** must explicitly contain and index a `tenant_id: uuid.UUID` property block. All SQLModel definitions must reside in `services/backend-api/src/orm/models`.

### Python Package Management (uv)

* **Package Manager:** Use **`uv`** for ALL Python dependency management. Never use `pip`, `pipenv`, or `poetry`.
* **Adding Dependencies:** Use `uv add <package>` instead of `pip install <package>`.
* **Running Commands:** Use `uv run <command>` to execute Python scripts, tests, or servers (e.g., `uv run pytest`, `uv run fastapi dev`).
* **Lock File:** The `uv.lock` file must be committed. Never ignore it.
* **Virtual Environments:** `uv` manages virtual environments automatically. Do not manually activate `.venv` or use `source .venv/bin/activate`.
* **Lockfile Integrity:** After modifying any dependency or configuration in `services/backend-api`, you MUST run `uv lock` to update the lockfile before executing the verification pipeline.

### Testing Standards

* **Frontend:** Use **Vitest** and **React Testing Library**. Mock API calls using MSW (Mock Service Worker) or Vitest mocks.
* **Backend:** Use **Pytest** and **HTTPX** (for FastAPI `TestClient`). Use `pytest-asyncio` for async endpoint testing.

---

## 3. Verification Pipeline Order

If backend structures, SQLModels, or route schemas change, you must follow this exact sequence before running standard workspace validations:

1. **[Backend Diagnostics]** Assert backend tests pass: `turbo run test --filter=backend-api`
2. **[Schema Sync]** Run client generation inside `packages/codegen` to fetch `openapi.json` and output updated TypeScript clients and Zod schemas.
3. **[Environment Sync]** Execute `uv sync --locked` to ensure local virtual environment sanity.
4. **[Linting]** Run `turbo run lint` across the monorepo spaces.
5. **[Typechecking]** Run `turbo run typecheck` to catch any broken frontend references caused by backend model shifts.
6. **[Testing]** Run global testing routines: `turbo run test`.

*Note: If encountering unexpected workspace behaviors, dependency mismatch failures, or cache-stale bugs during testing, append `--force` to the turbo command or use `uv sync --locked` to reset your Python workspace boundaries.*

---

## 4. Superpowers & Skill Hooks

* **Skill Invocation:** When implementing complex workflows (e.g., thumbnail generation), halt standard generation. You MUST read and strictly follow the architectural constraints defined in the corresponding skills file (e.g., `.opencode/agents/multi-tenant-platform.md`).
* **Path Resolution:** Resolve skill paths relative to the repository root (e.g., `.opencode/agents/...`).
* **Zero Yolo-Coding Policy:** Always generate a structural plan and wait for user approval before executing complex, multi-file edits. Do not execute unplanned mass modifications. (Note to Human: Ensure your AI IDE is set to 'Plan' or 'Ask' mode before triggering complex skill executions).

## 5. System Shorthand Description & Architectural Remarks

### Shorthand Profile

A high-performance **Turborepo monorepo** powering a multi-tenant Shopify-style SaaS platform. Uses a **Next.js (React 19)** frontend stack (`apps/admin`, `apps/storefront`) and a **FastAPI/Python** backend engine (`services/backend-api`). Strict data isolation is enforced at the storage tier via **PostgreSQL Row-Level Security (RLS)** using indexed `tenant_id` claims managed by **SQLModel**.

### Critical Operational Constraints

* **Strict ORM Decoupling:** Do not write direct database queries or instantiate raw database connections inside `apps/` or `services/backend-api/src/routes`. All TypeScript data mapping and query wrappers must reside exclusively inside `packages/tenant-orm`. All Python data mapping, multi-tenant queries, and SQLModel definitions must reside exclusively inside `services/backend-api/src/orm`.

* **ORM Tenant Scoping:** The Python ORM (`services/backend-api/src/orm`) must automatically scope all queries using a Python contextvars variable (e.g., current_tenant_id) populated by FastAPI middleware/dependencies. Never pass tenant_id as an explicit argument to standard CRUD methods to prevent accidental cross-tenant leakage.

* **Database Migration Fail-Safe:** Every migration script created or executed within `packages/db` must explicitly enable RLS on newly generated tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`). Do not rely on application-level filtering alone.
* **Environment Configuration:** Do not use, commit, or read from `.env` files. All workspace credentials, keys, and tokens must be injected at runtime via **Doppler** (`doppler run -- turbo run dev`).

* **Tailwind 4.x Theming Engine:** Tailwind 4 avoids JavaScript-based `tailwind.config.js` setups. All design tokens, custom utility definitions, and shadcn variables must be written directly via CSS-first `@theme` syntax rules within the `packages/ui` workspace. Use `@base-ui/react` components wherever possible.

* **Clerk v7 Authentication Flow:** Because legacy component blocks like `<SignedIn>` are deprecated, evaluate user access profiles entirely inside backend middleware or server-side layout token validation pipelines.

* **Codegen Ordering & Execution Fail-Safe:** Whenever backend models, endpoints, or Pydantic configurations are altered, you must generate the client interface *before* executing frontend compilation tasks. The pipeline must download the live OpenAPI JSON schema from the FastAPI context and pipe it through `@hey-api/openapi-ts` with the Zod validator plugin enabled to output native TypeScript types and Zod models directly into `packages/codegen/src/generated`.

* **API Client Enforcement:** All network communication from `apps/admin` and `apps/storefront` to `services/backend-api` MUST use the client instance exported by `packages/codegen`. Writing raw `fetch`, `axios`, `ky`, or manual Header appending routines outside this package's interceptor system is strictly prohibited.

* **API Client Auth Injection:** The generated client in `packages/codegen` must be configured with an auth interceptor that automatically attaches the Clerk session token to outgoing requests. Never manually attach auth headers or manage token lifecycles inside `apps/*`.

* **Migration Generation:** Use **Alembic** for SQLModel migrations. When adding/modifying models in `services/backend-api/src/orm`, generate migrations via: `alembic revision --autogenerate -m "description"`. Always manually verify the generated SQL in `packages/db` to ensure `ENABLE ROW LEVEL SECURITY` is present before applying.

* **Applying Migrations:** To apply pending migrations locally, execute `uv run alembic upgrade head` targeting the correct directory workspace boundaries relative to `services/backend-api/`. Never execute raw SQL scripts or bypass Alembic manually.

* **Zero Env Fallbacks:** NEVER use inline fallback defaults (such as `|| 'default'` or `?? 'default'`) for environment variables (e.g., `process.env.DB_URL || 'localhost'`). If a Doppler-injected variable is missing, the application must fail-fast and crash immediately at startup with an explicit initialization error.

* **Tenant Provisioning Safety:** Creating a new tenant must run through a unified database transaction that sets up the tenant metadata, provisions the base isolation rules, and applies the initial schema seeds. Partial tenant creation is considered a critical architectural failure.

* **Strict TypeScript Data Isolation:** Do not under any circumstances write raw database connections, execute manual Supabase configurations, or inject unsafely decoupled SQL queries inside `apps/`. Every TypeScript database data mutation or query wrapper must reside exclusively inside `packages/tenant-orm`.

* **Schema Schema Separation:** Maintain a strict logical separation inside `packages/tenant-orm/src/schemas/`:
  * `global/` schemas must only handle platform-level administration metadata.
  * `tenant/` schemas must govern isolated e-commerce operational states (Products, Orders, Settings) and must implicitly mandate tenant-scoping bounds.

* **Python Tooling Enforcement:** All Python commands (linting, formatting, testing, running the server) MUST be prefixed with `uv run`. Never invoke Python scripts directly or use `pip`. Example: Use `uv run ruff check .` not `ruff check .`.

* **API Client & Zod Binding:** All API calls from `apps/*` to `services/backend-api` MUST use the generated client from `packages/codegen`. When designing frontend forms with Zod, use `.pipe()` or explicit type matching to map the form state data directly onto the generated API request data models. Never create standalone frontend data interfaces that duplicate backend schemas.

* **Zero Local State Leakage:** Never generate, read, or commit local database binaries, SQLite containers, raw SQL dumps (`.sql`), or runtime-generated migration cache files outside of designated `packages/db` structures. Keep the git workspace completely pristine.
