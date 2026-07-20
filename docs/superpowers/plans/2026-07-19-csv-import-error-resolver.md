# CSV Import Error Resolver — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-19-csv-import-error-resolver.md`

---

## Step 1 — Verify Backend Endpoint

Check that `POST /customers/import/resolve` exists and works:

```bash
cd services/backend-api && PYTHONPATH=. doppler run -- uv run python -c "
from fastapi.testclient import TestClient
from src.main import app
client = TestClient(app)
resp = client.post('/api/v1/customers/import/resolve', json={'corrections':[]}, headers={'X-Tenant-ID':'...'})
print(resp.status_code)
"
```

If missing, add the endpoint to `routes/customers.py`.

---

## Step 2 — Build CsvErrorResolver Component

**File:** `apps/admin/src/components/customers/csv-error-resolver.tsx`

```tsx
interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}

interface CsvErrorResolverProps {
  errors: ImportError[];
  onResolve: (corrections: Correction[]) => Promise<void>;
  onClose: () => void;
}

interface Correction {
  row: number;
  [field: string]: string;
}
```

Dialog with editable table, pagination (20 rows/page), "Apply Corrections" button, loading state.

---

## Step 3 — Wire into Import Dialog

**File:** `apps/admin/src/components/customers/import-customer-dialog.tsx`

- Add `importResult` state to hold the response from `POST /customers/import`
- After upload: if `result.errors.length > 0`, show `CsvErrorResolver` with errors
- On `onResolve`: POST corrected data via `api.customers.resolveCsvErrors`, then refetch

---

## Step 4 — Verify

```bash
pnpm --filter admin exec tsc --noEmit
pnpm vitest run --project admin
```
