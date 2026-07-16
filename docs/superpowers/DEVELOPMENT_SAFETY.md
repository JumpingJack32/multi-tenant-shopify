## 🛡️ Local Development Safety & Database Reconstruction Guide

This project implements a multi-tenant architecture using FastAPI, SQLModel (PostgreSQL), and Doppler. To prevent accidental data loss and ensure zero-orphan data integrity, a defense-in-depth safety matrix is enforced across the database, code, and Git layers.

---

## 🛠️ The Local Safety Matrix

### 0. Test Database Isolation

The test suite uses a **completely separate PostgreSQL database** from development. This prevents `pytest` runs from touching your development data.

**Architecture:**

- `src/database.py` detects `APP_ENV=test` (set by `tests/conftest.py`) and reads `TEST_DATABASE_URL` from the environment instead of the production `DATABASE_URL`.
- `tests/conftest.py` creates all tables in the test database before the session and drops them after — leaving zero trace.
- Each test file that uses a sync engine (e.g., `_sync_engine()` in `test_collections.py`) reads `TEST_DATABASE_URL` directly.

**Setup (one-time):**

1. Create the test database in your local PostgreSQL:

   ```bash
   psql -U postgres -c "CREATE DATABASE multi_tenant_shopify_test;"
   ```

2. Add `TEST_DATABASE_URL` to your Doppler `dev` config:

   ```bash
   cd services/backend-api && doppler secrets set TEST_DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:54322/multi_tenant_shopify_test"
   ```

3. Verify isolation — run the test suite and confirm your dev DB is untouched:
   ```bash
   cd services/backend-api && doppler run -- uv run pytest -q
   ```

**Expected output:**

```
207 passed in 14s
```

The dev database (`DATABASE_URL`) is never read during test execution. Only `TEST_DATABASE_URL` is used.

---

### 1. Database Level: DDL Destruction Blocker

A custom PostgreSQL event trigger physically prevents destructive DDL commands (`DROP`, `TRUNCATE`) when connected to the local development instance.

- **Target File:** `services/backend-api/scripts/block_destructive_ddl.sql`
- **Coverage:** `DROP TABLE`, `DROP VIEW`, `DROP SCHEMA`, `DROP INDEX`, `TRUNCATE TABLE`, etc.

**Prerequisites:** Requires a PostgreSQL superuser role (or `psql` client with sufficient privileges) to install event triggers. If you lack superuser access, skip this layer — the code and Git layers still protect you.

**To Install/Refresh the Blocker:**

```bash
psql -d $(doppler run -- printenv DATABASE_URL | sed 's/.*\/\([^?]*\).*/\1/') \
  -f services/backend-api/scripts/block_destructive_ddl.sql
```

**How to Bypass (Superuser only):**

```sql
SET app.block_destructive = 'bypass';
-- Run your intentional structural modifications here
RESET app.block_destructive;
```

---

### 2. Code Level: Safe Seeding & Environment Gates

The seeding engine (`seed_database.py`) is fully idempotent but carries data-wiping routines for development rehydration. Two crucial constraints are enforced:

1. **Doppler Environment Guard** — The script reads `DOPPLER_ENVIRONMENT` (injected by `doppler run`) and aborts unless it is `dev`.
2. **Explicit Model Registration** — `import src.orm.models` must execute before `SQLModel.metadata.create_all()`. This guarantees all 23 multi-tenant tables are registered to the metadata engine, avoiding silent table omissions and subsequent foreign key failures.
3. **Interactive Confirmation Gate** — The script forces a manual confirmation string before `clear_data()` executes.

**Running a Full Reconstruction:**

```bash
cd services/backend-api && doppler run -- uv run python seed_database.py
```

**Expected Terminal Interaction:**

```
⚠️  DESTRUCTIVE OPERATION — this will DELETE all tenant-scoped data.
    Tables that will be wiped: orders, customers, products, inventory,
    purchase orders, stock transfers, carts, and related records.
    Tenants and tenant_users are preserved (except test tenants).

Type "DESTROY AND RESEED" to continue:
```

If run outside `doppler run` or with `DOPPLER_ENVIRONMENT` set to anything other than `dev`:

```
❌ Refusing to run in environment 'production'. This script is restricted to dev.
   Set DOPPLER_ENVIRONMENT=dev or run via: doppler run -- uv run python seed_database.py
```

---

### 3. Git Level: Destructive Code Commit Prevention

A shared Git hook intercepts commits containing destructive raw SQL string literals or migration files.

- **Target File:** `.githooks/pre-commit`

**To Activate Hooks Across the Team:**

```bash
git config core.hooksPath .githooks
```

If a developer attempts to commit a file containing `DROP TABLE`, `TRUNCATE`, or similar patterns, the commit aborts automatically. Use `git commit --no-verify` if intentional.

---

## 📈 Database Verification Reference

When running a clean re-seed using `random.seed(42)`, the test suite must hit **207 passing tests** and **0 errors**. The deterministic data profile should yield these exact row signatures:

| Table          | Deterministic Rows (`seed(42)`) | Notes                          |
| -------------- | ------------------------------- | ------------------------------ |
| `tenants`      | 3                               | Acme Corp, Globex Inc, Initech |
| `tenant_users` | 3                               | 1 admin per tenant             |
| `products`     | 12                              | 5 Acme + 4 Globex + 3 Initech  |
| `customers`    | 25                              | 8 Acme + 9 Globex + 8 Initech  |
| `orders`       | 52                              | 15–20 per tenant               |
| `order_items`  | 98                              | Linked to orders               |
| `variants`     | 12                              | 1 per product                  |
| `inventory`    | 24                              | 2 locations × 12 variants      |
| `suppliers`    | 9                               | 3 per tenant                   |

### Automated Referential Integrity Diagnostics

To verify zero orphan records across all foreign key relationships:

```sql
SELECT
  (SELECT COUNT(*) FROM order_items WHERE order_id NOT IN (SELECT id FROM orders)) AS orphaned_order_items,
  (SELECT COUNT(*) FROM order_items WHERE variant_id IS NOT NULL AND variant_id NOT IN (SELECT id FROM variants)) AS orphaned_variant_refs,
  (SELECT COUNT(*) FROM orders WHERE customer_id IS NOT NULL AND customer_id NOT IN (SELECT id FROM customers)) AS orphaned_customer_refs,
  (SELECT COUNT(*) FROM inventory WHERE variant_id NOT IN (SELECT id FROM variants)) AS orphaned_inventory,
  (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id NOT IN (SELECT id FROM suppliers)) AS orphaned_po_suppliers,
  (SELECT COUNT(*) FROM order_fulfillment_links WHERE order_item_id NOT IN (SELECT id FROM order_items)) AS orphaned_ofl_order_items,
  (SELECT COUNT(*) FROM order_fulfillment_links WHERE purchase_order_item_id NOT IN (SELECT id FROM purchase_order_items)) AS orphaned_ofl_po_items;
```

All counts must return **0**.

---

## 🧹 General Developer Safety Rules

1. **Never run `git clean -fd` without previewing first.** Always run `git clean -nfd` to see what will be deleted. This command destroys untracked files permanently — including in-progress work, scaffolding, and scripts that were never committed.
2. **Never run `seed_database.py` unless you intend to replace all tenant data.** It truncates every tenant-scoped table before inserting fresh random data. There is no undo.
3. **Never share a database between development and tests.** The `TEST_DATABASE_URL` isolation exists for exactly this reason — if your tests are hitting your dev database, stop and reconfigure.

---

## 🔧 Troubleshooting

| Problem                                                | Likely Cause                                             | Fix                                                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pytest` fails with `relation "xyz" does not exist`    | Test database not created or `TEST_DATABASE_URL` not set | Run `psql -U postgres -c "CREATE DATABASE multi_tenant_shopify_test;"` and verify `doppler secrets get TEST_DATABASE_URL` |
| `pytest` fails with `redis.exceptions.ConnectionError` | Some throttle tests require Redis locally                | Start Redis: `redis-server` or `brew services start redis`                                                                |
| Tests pass but dev database data disappears            | `APP_ENV=test` is leaking into dev processes             | Check that `APP_ENV` is not exported in your shell profile. The conftest sets it automatically.                           |
| Seed script hangs waiting for input                    | The `"DESTROY AND RESEED"` gate is blocking              | Type the exact phrase, or pipe it: `echo "DESTROY AND RESEED" \| doppler run -- uv run python seed_database.py`           |
| 207 tests expected but got fewer                       | Missing Doppler secrets or service not running           | Verify `doppler run -- printenv TEST_DATABASE_URL` returns a valid URL, and PostgreSQL is accepting connections           |

---

## 🤖 AI Agent Integration Directive

If using an LLM assistant or AI agent (such as OpenCode) to perform database operations, ensure the following rules are in its system prompt:

- All database reconstruction must follow a **Phased Reconstruction Engine**: Phase 1 (Read/Propose), Phase 2 (Structural Verification), Phase 3 (Population & FK Diagnostics).
- The seed script requires explicit human approval via the `"DESTROY AND RESEED"` confirmation gate.
- The agent must **never** run `git clean -fd` without previewing with `git clean -nfd` first.
- The agent must **never** run the seed script multiple times in a session — reseeding destroys existing data.
- The `docs/superpowers/specs/` directory contains all feature specifications. Read the relevant spec before implementing any feature, and wait for approval before writing code.
