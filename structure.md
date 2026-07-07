# Project Structure

```text
.
├── AGENTS.md
├── apps
│ ├── admin
│ │ ├── eslint.config.js
│ │ ├── next-env.d.ts
│ │ ├── next.config.ts
│ │ ├── package.json
│ │ ├── postcss.config.mjs
│ │ ├── src
│ │ │ ├── __tests__
│ │ │ │ └── helpers.tsx
│ │ │ ├── app
│ │ │ │ ├── (app)
│ │ │ │ │ ├── dashboard
│ │ │ │ │ │ └── page.tsx
│ │ │ │ │ ├── layout.tsx
│ │ │ │ │ ├── orders
│ │ │ │ │ │ └── page.tsx
│ │ │ │ │ ├── products
│ │ │ │ │ │ └── page.tsx
│ │ │ │ │ └── settings
│ │ │ │ │     └── page.tsx
│ │ │ │ ├── auth
│ │ │ │ │ └── sign-in
│ │ │ │ │     ├── __tests__
│ │ │ │ │     │ └── sign-in-page.test.tsx
│ │ │ │ │     ├── page
│ │ │ │ │     └── page.tsx
│ │ │ │ ├── layout.tsx
│ │ │ │ └── page.tsx
│ │ │ ├── components
│ │ │ │ ├── auth
│ │ │ │ │ └── logout-button.tsx
│ │ │ │ ├── layout
│ │ │ │ │ ├── app-shell.tsx
│ │ │ │ │ ├── header.tsx
│ │ │ │ │ └── sidebar.tsx
│ │ │ │ ├── orders
│ │ │ │ │ └── orders-table.tsx
│ │ │ │ ├── products
│ │ │ │ │ ├── __tests__
│ │ │ │ │ │ ├── product-form.test.tsx
│ │ │ │ │ │ └── product-table.test.tsx
│ │ │ │ │ ├── product-delete-dialog.tsx
│ │ │ │ │ ├── product-drawer.tsx
│ │ │ │ │ ├── product-form.tsx
│ │ │ │ │ ├── product-name-cell.tsx
│ │ │ │ │ ├── product-table.tsx
│ │ │ │ │ ├── relative-time-cell.tsx
│ │ │ │ │ ├── status-badge.tsx
│ │ │ │ │ ├── table-pagination.tsx
│ │ │ │ │ └── table-toolbar.tsx
│ │ │ │ └── ui
│ │ │ │     ├── button.tsx
│ │ │ │     ├── data-table.tsx
│ │ │ │     ├── drawer.tsx
│ │ │ │     └── error-banner.tsx
│ │ │ ├── contexts
│ │ │ │ ├── __tests__
│ │ │ │ │ ├── rbac-context.test.tsx
│ │ │ │ │ └── tenant-context.test.tsx
│ │ │ │ ├── rbac-context.tsx
│ │ │ │ └── tenant-context.tsx
│ │ │ ├── features
│ │ │ │ └── products
│ │ │ │     ├── api
│ │ │ │     │ └── products-service.ts
│ │ │ │     └── hooks
│ │ │ │         ├── __tests__
│ │ │ │         │ └── use-products.test.tsx
│ │ │ │         └── use-products.ts
│ │ │ ├── hooks
│ │ │ │ └── use-tenant.ts
│ │ │ ├── lib
│ │ │ │ ├── api
│ │ │ │ │ └── client.ts
│ │ │ │ ├── auth
│ │ │ │ │ └── get-current-user.ts
│ │ │ │ └── utils.ts
│ │ │ ├── proxy.ts
│ │ │ └── types
│ │ │     └── rbac.ts
│ │ └── tsconfig.json
│ └── storefront
│     ├── eslint.config.js
│     ├── next-env.d.ts
│     ├── next.config.ts
│     ├── package.json
│     ├── postcss.config.mjs
│     ├── src
│     │ ├── __tests__
│     │ │ └── helpers.tsx
│     │ ├── app
│     │ │ ├── [tenant]
│     │ │ │ ├── layout.tsx
│     │ │ │ ├── page.tsx
│     │ │ │ └── shop
│     │ │ │     └── [category]
│     │ │ │         └── page.tsx
│     │ │ ├── layout.tsx
│     │ │ └── page.tsx
│     │ ├── components
│     │ │ ├── providers.tsx
│     │ │ └── storefront
│     │ │     ├── __tests__
│     │ │     │ └── product-card.test.tsx
│     │ │     ├── cart.tsx
│     │ │     ├── product-card.tsx
│     │ │     └── storefront-image.tsx
│     │ ├── hooks
│     │ │ ├── __tests__
│     │ │ │ └── use-cart.test.ts
│     │ │ └── use-cart.ts
│     │ ├── lib
│     │ │ ├── __tests__
│     │ │ │ └── tenant-resolver.test.ts
│     │ │ ├── cloudinary.ts
│     │ │ ├── tenant-resolver.ts
│     │ │ └── utils.ts
│     │ └── proxy.ts
│     └── tsconfig.json
├── coverage
│ ├── apps
│ │ ├── admin
│ │ │ └── src
│ │ │     ├── components
│ │ │     │ ├── auth
│ │ │     │ │ ├── index.html
│ │ │     │ │ └── logout-button.tsx.html
│ │ │     │ ├── layout
│ │ │     │ │ ├── app-shell.tsx.html
│ │ │     │ │ ├── header.tsx.html
│ │ │     │ │ ├── index.html
│ │ │     │ │ └── sidebar.tsx.html
│ │ │     │ ├── orders
│ │ │     │ │ ├── index.html
│ │ │     │ │ └── orders-table.tsx.html
│ │ │     │ ├── products
│ │ │     │ │ ├── index.html
│ │ │     │ │ ├── product-delete-dialog.tsx.html
│ │ │     │ │ ├── product-drawer.tsx.html
│ │ │     │ │ ├── product-form.tsx.html
│ │ │     │ │ ├── product-name-cell.tsx.html
│ │ │     │ │ ├── product-table.tsx.html
│ │ │     │ │ ├── relative-time-cell.tsx.html
│ │ │     │ │ ├── status-badge.tsx.html
│ │ │     │ │ ├── table-pagination.tsx.html
│ │ │     │ │ └── table-toolbar.tsx.html
│ │ │     │ └── ui
│ │ │     │     ├── button.tsx.html
│ │ │     │     ├── drawer.tsx.html
│ │ │     │     ├── error-banner.tsx.html
│ │ │     │     └── index.html
│ │ │     ├── contexts
│ │ │     │ ├── index.html
│ │ │     │ ├── rbac-context.tsx.html
│ │ │     │ └── tenant-context.tsx.html
│ │ │     ├── features
│ │ │     │ └── products
│ │ │     │     ├── api
│ │ │     │     │ ├── index.html
│ │ │     │     │ └── products-service.ts.html
│ │ │     │     └── hooks
│ │ │     │         ├── index.html
│ │ │     │         └── use-products.ts.html
│ │ │     ├── index.html
│ │ │     └── proxy.ts.html
│ │ └── storefront
│ │     └── src
│ │         ├── components
│ │         │ └── storefront
│ │         │     ├── index.html
│ │         │     └── product-card.tsx.html
│ │         ├── hooks
│ │         │ ├── index.html
│ │         │ └── use-cart.ts.html
│ │         └── lib
│ │             ├── index.html
│ │             └── tenant-resolver.ts.html
│ ├── base.css
│ ├── block-navigation.js
│ ├── coverage-summary.json
│ ├── favicon.png
│ ├── index.html
│ ├── packages
│ │ ├── auth
│ │ │ └── src
│ │ │     ├── client.ts.html
│ │ │     ├── hooks.ts.html
│ │ │     ├── index.html
│ │ │     ├── middleware.ts.html
│ │ │     └── tenant.tsx.html
│ │ ├── middleware
│ │ │ └── src
│ │ │     ├── cors.ts.html
│ │ │     ├── index.html
│ │ │     ├── rate-limit.ts.html
│ │ │     ├── shopify.ts.html
│ │ │     └── webhooks.ts.html
│ │ ├── shared-utils
│ │ │ └── src
│ │ │     ├── cn.ts.html
│ │ │     ├── env.ts.html
│ │ │     ├── format.ts.html
│ │ │     └── index.html
│ │ ├── tenant-orm
│ │ │ └── src
│ │ │     ├── client.ts.html
│ │ │     ├── index.html
│ │ │     ├── schemas
│ │ │     │ ├── index.html
│ │ │     │ └── tenant.ts.html
│ │ │     └── tenant-resolver.ts.html
│ │ └── ui
│ │     └── src
│ │         ├── components
│ │         │ ├── button.tsx.html
│ │         │ ├── card.tsx.html
│ │         │ └── index.html
│ │         └── lib
│ │             ├── index.html
│ │             └── utils.ts.html
│ ├── prettify.css
│ ├── prettify.js
│ ├── sort-arrow-sprite.png
│ └── sorter.js
├── DESIGN (1).md
├── DESIGN_.md
├── DESIGN.md
├── docs
│ ├── audit_report
│ ├── continuous_implementation
│ │ └── FUTURE_IMPLEMENTATION.md
│ ├── custom
│ │ ├── _README_.md
│ │ ├── ADMINTABLES.md
│ │ ├── AGENT_.md
│ │ ├── AGENTS_.md
│ │ ├── AUTH.md
│ │ ├── CLI.md
│ │ ├── CUSTOMERTABLES.md
│ │ ├── DEPS.md
│ │ ├── doppler.md
│ │ ├── PROMPTS.md
│ │ └── summary.md
│ ├── generated_reports
│ │ ├── feature_comparison_report.md
│ │ ├── layer_status_report.md
│ │ └── PROJECT_STATUS.md
│ ├── images
│ │ └── ali-pazani-tgrGXZrwd7k-unsplash.jpg
│ ├── notes
│ │ ├── clerk-err.md
│ │ ├── cloudinary.md
│ │ ├── stock-picks.md
│ │ └── tailwind-css.md
│ ├── superpowers
│ │ ├── plans
│ │ │ ├── 2026-06-22-super-owner-invitation.md
│ │ │ ├── 2026-06-26-priority-based-phased-plan.md
│ │ │ ├── 2026-06-29-project-status-report.md
│ │ │ ├── 2026-07-01-admin-ui-working.md
│ │ │ ├── 2026-07-01-js-ts-test-suite.md
│ │ │ ├── 2026-07-01-project-status-report.md
│ │ │ ├── 2026-07-01-round-2-test-expansion.md
│ │ │ ├── IMPLEMENTATION_PLAN.md
│ │ │ └── review-and-fix-plan.md
│ │ └── specs
│ │     ├── 2026-07-01-admin-ui-working.md
│ │     ├── 2026-07-01-js-ts-test-suite-design.md
│ │     ├── 2026-07-01-round-2-test-expansion.md
│ │     ├── 2026-07-02-storefront-plp-pdp.md
│ │     └── ai-editorial-rules.md
│ ├── theme.css
│ ├── todos
│ │ └── 2026-06-26-priority-based-phased-plan-todos.md
│ └── tree.md
├── package.json
├── packages
│ ├── auth
│ │ ├── package.json
│ │ ├── src
│ │ │ ├── __tests__
│ │ │ │ ├── api-client.test.ts
│ │ │ │ ├── helpers.ts
│ │ │ │ ├── hooks.test.tsx
│ │ │ │ ├── integration.test.ts
│ │ │ │ ├── middleware.test.ts
│ │ │ │ └── tenant.test.tsx
│ │ │ ├── client.ts
│ │ │ ├── hooks.ts
│ │ │ ├── index.ts
│ │ │ ├── middleware.ts
│ │ │ ├── provider.tsx
│ │ │ ├── server.ts
│ │ │ └── tenant.tsx
│ │ └── tsconfig.json
│ ├── codegen
│ │ ├── openapi-ts.config.ts
│ │ ├── package.json
│ │ ├── src
│ │ │ └── generated
│ │ │     ├── clients
│ │ │     │ └── index.ts
│ │ │     └── schemas
│ │ │         └── index.ts
│ │ └── tsconfig.json
│ ├── db
│ │ ├── migrations
│ │ │ └── 0001_initial.sql
│ │ └── package.json
│ ├── eslint-config
│ │ ├── index.js
│ │ └── package.json
│ ├── middleware
│ │ ├── package.json
│ │ ├── src
│ │ │ ├── __tests__
│ │ │ │ ├── cors.test.ts
│ │ │ │ ├── rate-limit.test.ts
│ │ │ │ ├── shopify.test.ts
│ │ │ │ └── webhooks.test.ts
│ │ │ ├── cors.ts
│ │ │ ├── index.ts
│ │ │ ├── rate-limit.ts
│ │ │ ├── shopify.ts
│ │ │ └── webhooks.ts
│ │ └── tsconfig.json
│ ├── shared-utils
│ │ ├── package.json
│   │   ├── src
│   │   │   ├── __tests__
│   │   │   │   ├── cn.test.ts
│   │   │   │   ├── dates.test.ts
│   │   │   │   ├── env.test.ts
│   │   │   │   └── format-currency.test.ts
│   │   │   ├── cn.ts
│   │   │   ├── env.ts
│   │   │   ├── format.ts
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   ├── tenant-orm
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── __tests__
│   │   │   │   ├── client.test.ts
│   │   │   │   ├── order-schema.test.ts
│   │   │   │   ├── product-schema.test.ts
│   │   │   │   └── tenant-resolver.test.ts
│   │   │   ├── client.ts
│   │   │   ├── index.ts
│   │   │   ├── schemas
│   │   │   │   ├── global.ts
│   │   │   │   ├── index.ts
│   │   │   │   └── tenant.ts
│   │   │   ├── tenant-resolver.ts
│   │   │   └── types.ts
│   │   └── tsconfig.json
│   ├── typescript-config
│   │   ├── base.json
│   │   ├── nextjs.json
│   │   ├── package.json
│   │   └── react-library.json
│   └── ui
│       ├── components.json
│       ├── eslint.config.js
│       ├── package.json
│       ├── src
│       │   ├── __tests__
│       │   │   ├── button.test.tsx
│       │   │   ├── card.test.tsx
│       │   │   └── setup.ts
│       │   ├── components
│       │   │   ├── button.tsx
│       │   │   ├── card.tsx
│       │   │   ├── data-table.tsx
│       │   │   ├── motion.tsx
│       │   │   ├── table.tsx
│       │   │   └── ui
│       │   │       ├── button.tsx
│       │   │       └── index.ts
│       │   ├── index.ts
│       │   ├── lib
│       │   │   └── utils.ts
│       │   └── styles
│       │       ├── base-ui.ts
│       │       ├── globals.css
│       │       └── radix-ui.ts
│       ├── tsconfig.json
│       └── tsconfig.lint.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── PROJECT_CONTEXT.md
├── prompt.txt
├── README.md
├── services
│   └── backend-api
│       ├── alembic
│       │   ├── env.py
│       │   ├── script.py.mako
│       │   └── versions
│       │       ├── 0001_initial.py
│       │       └── 0002_add_platform_superuser.py
│       ├── alembic.ini
│       ├── pyproject.toml
│       ├── seed_database.py
│       ├── src
│       │   ├── __pycache__
│       │   │   ├── config.cpython-314.pyc
│       │   │   ├── database.cpython-314.pyc
│       │   │   ├── dependencies.cpython-314.pyc
│       │   │   └── main.cpython-314.pyc
│       │   ├── config.py
│       │   ├── core
│       │   │   ├── __pycache__
│       │   │   │   ├── cache.cpython-314.pyc
│       │   │   │   ├── clerk_jwks.cpython-314.pyc
│       │   │   │   ├── cloudinary.cpython-314.pyc
│       │   │   │   ├── security.cpython-314.pyc
│       │   │   │   └── tenant_isolation.cpython-314.pyc
│       │   │   ├── base.py
│       │   │   ├── cache.py
│       │   │   ├── clerk_jwks.py
│       │   │   ├── cloudinary.py
│       │   │   ├── multi_currency.py
│       │   │   ├── polymorphic.py
│       │   │   ├── security.py
│       │   │   ├── tax_rates.py
│       │   │   └── tenant_isolation.py
│       │   ├── database.py
│       │   ├── dependencies.py
│       │   ├── main.py
│       │   ├── middleware
│       │   │   ├── __pycache__
│       │   │   │   └── tenant_middleware.cpython-314.pyc
│       │   │   └── tenant_middleware.py
│       │   ├── orm
│       │   │   ├── __pycache__
│       │   │   │   └── base.cpython-314.pyc
│       │   │   ├── base.py
│       │   │   ├── models
│       │   │   │   ├── __init__.py
│       │   │   │   ├── __pycache__
│       │   │   │   │   ├── __init__.cpython-314.pyc
│       │   │   │   │   ├── order.cpython-314.pyc
│       │   │   │   │   ├── product.cpython-314.pyc
│       │   │   │   │   └── tenant.cpython-314.pyc
│       │   │   │   ├── order.py
│       │   │   │   ├── product.py
│       │   │   │   └── tenant.py
│       │   │   └── schemas
│       │   │       ├── __init__.py
│       │   │       ├── __pycache__
│       │   │       │   ├── __init__.cpython-314.pyc
│       │   │       │   ├── order.cpython-314.pyc
│       │   │       │   ├── product.cpython-314.pyc
│       │   │       │   └── tenant.cpython-314.pyc
│       │   │       ├── order.py
│       │   │       ├── product.py
│       │   │       └── tenant.py
│       │   ├── routes
│       │   │   ├── __pycache__
│       │   │   │   ├── admin_auth.cpython-314.pyc
│       │   │   │   ├── auth.cpython-314.pyc
│       │   │   │   ├── media.cpython-314.pyc
│       │   │   │   ├── orders.cpython-314.pyc
│       │   │   │   ├── products.cpython-314.pyc
│       │   │   │   ├── public.cpython-314.pyc
│       │   │   │   ├── tenants.cpython-314.pyc
│       │   │   │   └── webhooks.cpython-314.pyc
│       │   │   ├── admin_auth.py
│       │   │   ├── auth.py
│       │   │   ├── media.py
│       │   │   ├── orders.py
│       │   │   ├── products.py
│       │   │   ├── public.py
│       │   │   ├── tenants.py
│       │   │   └── webhooks.py
│       │   └── tasks
│       │       ├── image_processing.py
│       │       └── order_tasks.py
│       ├── tests
│       │   ├── __pycache__
│       │   │   ├── conftest.cpython-314-pytest-9.1.0.pyc
│       │   │   └── test_platform_superuser.cpython-314-pytest-9.1.0.pyc
│       │   ├── conftest.py
│       │   ├── test_health.py
│       │   ├── test_platform_superuser.py
│       │   ├── test_tenant_middleware.py
│       │   └── test_tenants.py
│       └── uv.lock
├── skills-lock.json
├── structure.md
├── supabase
│   └── snippets
├── turbo.json
└── vitest.config.ts

147 directories, 351 files
```
