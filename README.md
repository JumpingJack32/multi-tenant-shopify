<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/graph.svg?title=Multi-Tenant+Shopify&subtitle=Production-grade+multi-tenant+e-commerce+platform&logo=vercel&mode=dark&theme=slate" />
    <img alt="Multi-Tenant Shopify" src="https://shieldcn.dev/header/graph.svg?title=Multi-Tenant+Shopify&subtitle=Production-grade+multi-tenant+e-commerce+platform&logo=vercel&mode=light&theme=slate" />
  </picture>
</p>

<p align="center">
  <a href="https://github.com/JumpingJack32/multi-tenant-shopify/stargazers">
    <img src="https://shieldcn.dev/github/stars/JumpingJack32/multi-tenant-shopify.svg?variant=secondary" alt="GitHub stars" />
  </a>
  <a href="https://github.com/JumpingJack32/multi-tenant-shopify/actions">
    <img src="https://shieldcn.dev/github/ci/JumpingJack32/multi-tenant-shopify.svg?variant=secondary" alt="CI status" />
  </a>
  <a href="https://github.com/JumpingJack32/multi-tenant-shopify/blob/main/LICENSE">
    <img src="https://shieldcn.dev/github/license/JumpingJack32/multi-tenant-shopify.svg?variant=secondary" alt="License" />
  </a>
  <a href="https://github.com/JumpingJack32/multi-tenant-shopify/issues">
    <img src="https://shieldcn.dev/github/issues/JumpingJack32/multi-tenant-shopify.svg?variant=secondary" alt="GitHub issues" />
  </a>
  <a href="https://github.com/JumpingJack32/multi-tenant-shopify/commits/main">
    <img src="https://shieldcn.dev/github/last-commit/JumpingJack32/multi-tenant-shopify.svg?variant=secondary" alt="Last commit" />
  </a>
</p>

---

A production-grade **multi-tenant SaaS platform** modeled after Shopify's e-commerce architecture. Built on a **Turborepo monorepo** with a **Next.js** frontend ecosystem and a **FastAPI (Python)** backend, enforcing strict tenant data isolation via PostgreSQL Row-Level Security (RLS).

- **Self-serve onboarding** — 3-step wizard, subdomain pre-flight, Stripe 14-day trial
- **Marketing landing page** — hero, feature grid, interactive pricing matrix
- **Flagship showcase store** — curated catalog, variant matrices, multi-warehouse stock

---

## Architecture

```text
       [ Storefront Workspace ]           [ Admin Dashboard Workspace ]
       apps/storefront (Next.js)          apps/admin (Next.js)
                  │                                     │
                  └───────────────┐     ┌───────────────┘
                                  ▼     ▼
                    [ FastAPI Gateway (services/backend-api) ]
                    Multi-tenant, Clerk JWT, CurrencyAwareRoute
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
   [ Tax & Pricing ]     [ Split Fulfillment ]   [ Segment Analytics ]
   Penny-perfect,        Multi-package,          Isolated query blocks,
   multi-currency logs   pessimistic row locks   async background runner
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  ▼
                     [ PostgreSQL (Shared-Schema Multi-Tenancy) ]
                      Every table scoped by tenant_id
                      Row-Level Security enforced
                      Validated at 50,000+ orders
                      Sub-10ms P95 query latencies
```

### Multi-Tenant Data Isolation

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
| **AI**                    | Local Ollama (qwen2.5:7b), OpenAI-compatible route      |
| **Media**                 | Cloudinary (unsigned upload, image + video)             |
| **Email**                 | Resend (production), LogEmailService (dev)              |
| **Payments**              | Stripe Checkout Sessions + Customer Portal (optional)   |
| **Webhooks**              | Svix (optional)                                         |
| **Validation**            | Zod, Pydantic                                           |
| **Secrets**               | Doppler                                                 |
| **Migrations**            | Alembic (Python)                                        |
| **Error Tracking**        | Sentry (optional)                                       |
| **Rate Limiting**         | In-memory (Redis swap available)                        |

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/JumpingJack32/multi-tenant-shopify.git
cd multi-tenant-shopify
pnpm install
```

### 2. Configure secrets with Doppler

```bash
doppler setup  # links your Doppler project
doppler run -- pnpm turbo run dev
```

**Note:** Secrets are managed via Doppler. Never hardcode or commit `.env` files.

### 3. Start database

```bash
# Start local Supabase (PostgreSQL) and Redis
docker compose -f supabase/docker-compose.yml up -d
docker run -d -p 6379:6379 redis:7-alpine
```

### 4. Run database migrations

```bash
cd services/backend-api
uv run alembic upgrade head
```

### 5. (Optional) Seed test data

```bash
cd services/backend-api
doppler run -- uv run python seed_database.py
```

### 6. Start development

```bash
# At the root — starts all apps with Doppler
doppler run -- pnpm turbo run dev
```

This starts:

- **Admin app** → [http://localhost:3001](http://localhost:3001)
- **Storefront** → [http://localhost:3000](http://localhost:3000)
- **Backend API** → [http://localhost:8000](http://localhost:8000)
- **API docs** → [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Project Structure

```text
├── apps/
│   ├── admin/              # Next.js admin control panel (tenant management)
│   └── storefront/         # Next.js dynamic e-commerce storefront
├── packages/
│   ├── auth/               # Clerk auth utilities, JWT helpers, middleware factory
│   ├── codegen/            # Auto-generated TypeScript types & Zod schemas from OpenAPI
│   ├── editor/             # Shared Unlayer email editor wrapper (react-email-editor)
│   ├── eslint-config/      # Shared ESLint configuration
│   ├── middleware/          # Webhook signature verification, rate limiting, CORS
│   ├── shared-utils/       # cn(), currency formatting, date helpers
│   ├── tenant-orm/         # TypeScript multi-tenant data access, Supabase client, Zod schemas
│   ├── typescript-config/  # Shared TS configs (base, nextjs, react-library)
│   └── ui/                 # Design tokens, Tailwind 4 config, shadcn/ui + Base UI primitives
├── services/
│   └── backend-api/        # FastAPI/Python backend (SQLModel ORM, routes, webhooks, tasks)
├── .github/workflows/      # CI pipeline (lint, typecheck, frontend + backend tests)
```

---

## Key Features

| Feature                     | Description                                                                    |
| --------------------------- | ------------------------------------------------------------------------------ |
| **Multi-Tenant**            | Strict tenant isolation via shared-schema RLS, tenant context                  |
| **SaaS Onboarding**         | 3-step wizard, subdomain pre-flight, Stripe trial subscription                 |
| **Pricing Tiers**           | Interactive pricing matrix, monthly/annual toggle, `SaaSPlan` model            |
| **Navigation Menu**         | Dynamic per-tenant nav tree, admin drag-and-drop builder, storefront mega menu |
| **Product Management**      | Full CRUD with variants, pricing (cents), Cloudinary media                     |
| **Customer Management**     | Segmentation, saved segments, store credit, timeline, import/export CSV        |
| **Order Lifecycle**         | State machine, inventory deduction, refund-to-store-credit                     |
| **Multi-Currency**          | Exchange rate conversion, storefront display, ledger capture                   |
| **Tax Engine**              | Per-tenant configurable rates (×10000), inclusive/exclusive, Stripe Tax codes  |
| **Shipping**                | Flat-rate, free-threshold, weight-based tiers; admin configurable              |
| **Split Fulfillment**       | Multi-package shipments, carrier tracking, over-fulfillment guard              |
| **Dashboard & Analytics**   | Reports (sales/products/customers/carts), live view, custom SQL builder        |
| **Storefront PLP/PDP**      | Catch-all taxonomy routes, sort/filter, image gallery, stock-aware variants   |
| **Automated Campaigns**     | Background segment evaluation, campaign dispatch via Resend batch              |
| **Email Templates**         | Unlayer visual editor, Jinja2 tokens, Resend delivery                          |
| **Stripe Checkout**         | Hosted Checkout Sessions with Adapter Pattern, anyio thread safety             |
| **Stripe Customer Portal**  | Self-serve billing management, saved cards, guest auth guard                   |
| **AI Content Generation**   | FastAPI adapter (Ollama/OpenRouter/OpenAI), SSE streaming, bleach sanitization |
| **Rich Text Editor**        | Unlayer-based WYSIWYG with merge tags for campaign templates                   |
| **Abandoned Cart Recovery** | Scheduled email reminders (Resend), unsubscribes                               |
| **Performance Caching**     | Next.js fetch cache with tenant-scoped tags, SWR, fire-and-forget revalidation |

---

## Common Commands

| Command                                         | Description                      |
| ----------------------------------------------- | -------------------------------- |
| `pnpm turbo run dev`                            | Start all workspaces in dev mode |
| `pnpm turbo run build`                          | Build all workspaces             |
| `pnpm turbo run lint`                           | Lint all workspaces              |
| `pnpm turbo run typecheck`                      | Type-check all workspaces        |
| `pnpm turbo run test`                           | Run all tests                    |
| `cd services/backend-api && uv run pytest`      | Run backend tests only           |
| `uv run alembic upgrade head`                   | Apply pending DB migrations      |
| `doppler run -- uv run python seed_database.py` | Seed test data                   |

### Backend-specific commands

All Python commands must use `uv`. Commands that need secrets must be prefixed with `doppler run`:

```bash
cd services/backend-api
doppler run -- uv run uvicorn src.main:app --reload          # Start backend dev server
doppler run -- uv run pytest                                 # Run tests
uv run ruff check .                                          # Lint (no secrets needed)
uv run alembic upgrade head                                  # Migrations (no secrets needed)
```

---

## CI/CD

GitHub Actions runs on every push/PR to `main` with four jobs:

1. **Lint** — Ruff (Python), ESLint (admin + storefront)
2. **TypeCheck** — `tsc --noEmit` for admin + storefront
3. **Frontend Tests** — Vitest across all packages
4. **Backend Tests** — Pytest with separate test database (isolated from dev data)
5. **AI Smoke Tests** — Backend `/api/v1/ai/generate` endpoint verified via pytest integration

---

## Contributing

1. Read `AGENTS.md` for detailed architectural constraints and session context
2. Follow the verification pipeline:
   - `pnpm turbo run lint`
   - `pnpm turbo run typecheck`
   - `pnpm turbo run test`
3. Use Doppler for secrets — never `.env` files
4. All DB queries go through `packages/tenant-orm` (TS) or `services/backend-api/src/orm` (Python)
5. Keep commits small and focused

---

## License

Proprietary — see license file for details.
