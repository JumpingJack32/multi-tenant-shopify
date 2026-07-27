# Order Export Engine — Implementation Plan

**Spec:** CSV order exports + PDF invoices/packing slips

---

## Step 1 — Export Service

**File:** `src/services/export_service.py`

- `export_orders_csv(db, tenant_id, filters)` — streaming CSV via Python csv writer, yields chunks. Headers: Order ID, Date, Customer, Items, Subtotal, Tax, Shipping, Discount, Total, Status, Shipping Address
- `generate_invoice_pdf(order_id, db, tenant_id)` — lightweight HTML template → PDF via `weasyprint` or inline CSS + `pdfkit`. Includes store name, addresses, line items, totals, tracking info

## Step 2 — Export Endpoints

**File:** `src/routes/admin_orders.py` (new)

- `POST /admin/orders/export/csv` — accepts `{ start_date, end_date, status }`, returns `StreamingResponse` with `Content-Disposition: attachment; filename="orders-export.csv"`
- `GET /admin/orders/{id}/pdf` — returns PDF invoice as `FileResponse`

## Step 3 — Admin UI

**File:** `apps/admin/src/app/(app)/orders/page.tsx`
- "Export CSV" button above the orders table → opens modal with date range + status filter
- "Invoice" button on each order row → links to PDF download

## Step 4 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
