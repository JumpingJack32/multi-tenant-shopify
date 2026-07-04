# Multi-Tenant Shopify Platform

A production-grade multi-tenant SaaS platform modeled after Shopify's e-commerce architecture. Built on a **Turborepo monorepo** with a **Next.js** frontend ecosystem and a **FastAPI (Python)** backend, enforcing strict tenant data isolation via PostgreSQL Row-Level Security (RLS).

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Turborepo Monorepo                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  apps/admin   │  │  storefront  │  │ services/api     │  │
│  │  (Next.js)    │  │  (Next.js)   │  │  (FastAPI/Python)│  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                  │                    │           │
│  ┌──────┴──────────────────┴────────────────────┴─────────┐ │
│  │                     Packages                             │ │
│  │  auth │ ui │ tenant-orm │ middleware │ codegen │ db     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │           PostgreSQL + Row-Level Security                │ │
│  │  (all tables scoped by tenant_id via mandatory FK)       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Tenant Data Isolation

This platform uses **shared-schema multi-tenancy** enforced at the database level:

- Every table includes a mandatory `tenant_id` foreign key column
- PostgreSQL Row-Level Security (RLS) automatically scopes all queries
- SQLModel event listeners inject `tenant_id` into queries transparently
- TypeScript data access lives in `packages/tenant-orm` — never raw DB queries in apps
- Python ORM lives in `services/backend-api/src/orm` — never raw DB in routes

---

## Tech Stack

| Layer                     | Technology                                              |
| ------------------------- | ------------------------------------------------------- |
| **Monorepo**              | Turborepo 2.x, pnpm 11.x                                |
| **Frontend (admin)**      | Next.js 16, React 19, Shadcn, Base UI, Tailwind CSS 4   |
| **Frontend (storefront)** | Next.js 16, React 19, Zustand, Tailwind CSS 4           |
| **Backend API**           | FastAPI 0.115+, Python 3.14, uv                         |
| **ORM**                   | SQLModel / SQLAlchemy (Python), Supabase JS Client (TS) |
| **Database**              | PostgreSQL 15+ (Supabase) with RLS                      |
| **Auth**                  | Clerk (@clerk/nextjs, clerk-backend-api)                |
| **Payments**              | Stripe (optional)                                       |
| **Webhooks**              | Svix (optional)                                         |
| **Validation**            | Zod, Pydantic                                           |
| **Secrets**               | Doppler                                                 |
| **Migrations**            | Alembic (Python)                                        |

---

## Prerequisites

- **Node.js** >= 22
- **pnpm** >= 11
- **uv** (Python package manager)
- **Python** >= 3.14
- **Docker** (for local Supabase/Redis)
- **Doppler CLI** (for secrets)

---

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url> multi-tenant-shopify
cd multi-tenant-shopify
pnpm install
```

### 2. Configure secrets with Doppler

```bash
doppler setup  # links your Doppler project
doppler run -- pnpm turbo run dev
```

Or copy the example env for local development:

```bash
cp .env.example .env
# Fill in your Supabase, Clerk, and other credentials
```

**Note:** Secrets are managed via Doppler. Never hardcode or commit `.env` files.

### 3. Start Supabase and Redis

```bash
# Start local Supabase (PostgreSQL)
cd supabase && docker compose up -d

# Start local Redis (if enabled)
docker run -d -p 6379:6379 redis:7-alpine
```

### 4. Run database migrations

```bash
cd services/backend-api
uv run alembic upgrade head
```

### 5. Start development

```bash
# At the root — starts all apps with Doppler
doppler run -- pnpm turbo run dev
```

This starts:

- **Admin app** → <http://localhost:3000>
- **Storefront** → <http://localhost:3001>
- **Backend API** → <http://localhost:8000>
- **API docs** → <http://localhost:8000/docs>

---

## Project Structure

```text
├── apps/
│   ├── admin/              # Next.js admin control panel (tenant management)
│   ├── storefront/         # Next.js dynamic e-commerce storefront
├── packages/
│   ├── auth/               # Clerk auth utilities, JWT helpers, middleware factory
│   ├── codegen/            # Auto-generated TypeScript types & Zod schemas from OpenAPI
│   ├── db/                 # Raw migration scripts and schema setup
│   ├── eslint-config/      # Shared ESLint configuration
│   ├── middleware/          # Webhook signature verification, rate limiting, CORS
│   ├── shared-utils/       # cn(), date formatting, common helpers
│   ├── tenant-orm/         # TypeScript multi-tenant data access, Supabase client, Zod schemas
│   ├── typescript-config/  # Shared TS configs (base, nextjs, react-library)
│   ├── ui/                 # Design tokens, Tailwind 4 config, shadcn/ui + Base UI primitives
├── services/
│   ├── backend-api/        # FastAPI/Python backend (SQLModel ORM, routes, webhooks)
├── docs/                   # Documentation, plans, todos
```

---

## Common Commands

| Command                                    | Description                      |
| ------------------------------------------ | -------------------------------- |
| `pnpm turbo run dev`                       | Start all workspaces in dev mode |
| `pnpm turbo run build`                     | Build all workspaces             |
| `pnpm turbo run lint`                      | Lint all workspaces              |
| `pnpm turbo run typecheck`                 | Type-check all workspaces        |
| `pnpm turbo run test`                      | Run all tests                    |
| `pnpm turbo run clean`                     | Clean build artifacts            |
| `cd services/backend-api && uv run pytest` | Run backend tests only           |
| `uv run alembic upgrade head`              | Apply pending DB migrations      |

### Backend-specific commands

All Python commands must use `uv`. Commands that need secrets (API keys, DB creds) must be prefixed with `doppler run`:

```bash
cd services/backend-api
doppler run -- uv run uvicorn src.main:app --reload          # Start backend dev server
doppler run -- uv run pytest                                 # Run tests
uv run ruff check .                                          # Lint (no secrets needed)
uv run alembic upgrade head                                  # Migrations (no secrets needed)
```

---

## Usage

### Admin Dashboard (`http://localhost:3000`)

Sign in with Clerk, then manage tenants, products, orders, and settings. Tenant switching is handled via the sidebar dropdown.

### Storefront (`http://localhost:3001`)

Tenant-aware e-commerce storefront. Access via `http://localhost:3001/<tenant-slug>`.

### API (`http://localhost:8000`)

FastAPI backend with auto-generated OpenAPI docs at `/docs`. All tenant-scoped requests must include a valid Clerk JWT and will be isolated via RLS.

---

## Contributing

1. Read `AGENTS.md` for detailed architectural constraints
2. Read the plan files in `docs/superpowers/plans/` for current work
3. Follow the verification pipeline:
   - Run `turbo run lint`
   - Run `turbo run typecheck`
   - Run `turbo run test`
4. Use Doppler for secrets — never `.env` files
5. All DB queries go through `packages/tenant-orm` (TS) or `services/backend-api/src/orm` (Python)
6. Keep commits small and focused

---

## License

Proprietary — see license file for details.
