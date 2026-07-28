# Admin Subscription Analytics — Implementation Plan

**Spec:** Admin Subscription Analytics & Lifecycle Management

---

## Step 1 — Analytics Service

**File:** `src/services/subscription_analytics_service.py`

- `get_subscription_metrics(db, tenant_id)` — single-flight query returning:
  - `mrr` — sum of active subscription values normalized to 30 days
  - `active_subscribers` — count of active subscriptions
  - `churn_rate_30d` — canceled in last 30d / active at start of period
  - `arpu` — MRR / active subscribers
  - `total_ltv` — sum of all subscription orders

## Step 2 — Admin Endpoints

**File:** `src/routes/admin_subscriptions.py`

- `GET /admin/subscriptions/metrics` — returns KPI data
- `GET /admin/subscriptions/list` — paginated subscriber list with plan, status, next billing
- `PUT /admin/subscriptions/{id}/status` — pause/resume/cancel

## Step 3 — Admin UI

**File:** `apps/admin/src/app/(app)/subscriptions/page.tsx`
- KPI cards: MRR, active subscribers, churn rate, ARPU
- Subscription table with status badges, next billing, LTV
- Inline status actions (pause/resume/cancel)

## Step 4 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
