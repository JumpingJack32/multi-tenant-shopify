# CSV Import Error Resolver — Specification

> **Status:** Draft

---

## 1. Value

When an admin imports customers via CSV, rows with invalid data (bad email, missing fields) are rejected. Currently the API returns errors but the UI has no way to fix them — the admin must re-upload the entire file. This spec adds an inline error reconciliation dialog so admins can see exactly which rows failed, edit the invalid values, and apply corrections without re-uploading.

---

## 2. Architecture

```
[ CSV Upload ] ──POST /customers/import──> { total, imported, errors[] }
                                                   │
              ┌────────────────────────────────────┴────────────────────────┐
              │  Errors are stored in-memory and displayed in               │
              │  CsvErrorResolver dialog — table of { row, field,           │
              │  value, message } with editable correction inputs           │
              └────────────────────────────────────┬────────────────────────┘
                                                   │
              ┌────────────────────────────────────┴────────────────────────┐
              │  Admin edits cells → "Apply Corrections"                    │
              │  → POST /customers/import/resolve with corrected rows       │
              │  → Backend upserts corrected rows                           │
              └─────────────────────────────────────────────────────────────┘
```

---

## 3. Backend: Resolve Endpoint

### `POST /customers/import/resolve`

Already exists in `routes/customers.py`. Accepts corrected rows and upserts them.

**Payload:**

```json
{
  "corrections": [
    { "row": 24, "email": "john.doe@gmail.com" },
    { "row": 31, "first_name": "Jane", "last_name": "Doe" }
  ]
}
```

**Flow:**

- Merges corrections with original row data from the import session
- Upserts each corrected row via `ON CONFLICT (tenant_id, email) DO UPDATE`
- Returns updated totals: `{ total, imported, errors }`

---

## 4. Frontend: CsvErrorResolver

### Component: `CsvErrorResolver`

**File:** `apps/admin/src/components/customers/csv-error-resolver.tsx`

A dialog that opens after a CSV import completes with errors:

- **Header**: "X errors in Y rows — review and correct below"
- **Table**: Columns — Row #, Field, Original Value, Corrected Value (editable input), Error Message
- **Behavior**: Admin clicks into any "Corrected Value" cell and types the fix
- **Actions**:
  - "Apply Corrections" — POSTs corrected rows to `/customers/import/resolve`, then refetches customer list
  - "Discard" — closes dialog, errors are lost (import already recorded the successful rows)

### Integration

**File:** `apps/admin/src/components/customers/import-customer-dialog.tsx`

- After CSV upload completes, if `response.errors.length > 0`, set `importResult` state with the errors
- Render `<CsvErrorResolver>` dialog or inline section with the error data
- Pass back the corrected payload via `onResolve` callback

### States

| State                  | Handling                                         |
| ---------------------- | ------------------------------------------------ |
| No errors              | Dialog doesn't open — show success toast instead |
| Errors present         | Table opens with all error rows pre-populated    |
| Loading correction     | "Applying..." button state                       |
| Correction success     | Toast + close dialog + refetch customers         |
| Correction API failure | Error banner, keep dialog open                   |

---

## 5. Files Changed

| File                                                             | Change                                   |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `apps/admin/src/components/customers/csv-error-resolver.tsx`     | **New** — error resolution dialog        |
| `apps/admin/src/components/customers/import-customer-dialog.tsx` | Wire upload response → error resolver    |
| `apps/admin/src/lib/api/client.ts`                               | Add `resolveCsvErrors` method if missing |

---

## 6. Risks

| Risk                                          | Mitigation                                                  |
| --------------------------------------------- | ----------------------------------------------------------- |
| Large error sets (100+ rows) overwhelm dialog | Paginate or virtualize the table; show 20 rows at a time    |
| Admin corrects email to existing customer     | Backend `ON CONFLICT` handles gracefully — updates existing |
| Admin closes dialog, loses corrections        | Warning prompt if unsaved corrections exist (beforeunload)  |
