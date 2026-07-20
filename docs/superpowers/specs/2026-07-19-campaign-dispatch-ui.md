# Campaign Dispatch Admin UI — Specification

> **Status:** Draft

---

## 1. Value

The `POST /marketing/dispatches` endpoint and `CampaignRunner` background engine are fully functional but have no admin interface. This spec adds a dispatch management page with list/create/schedule/cancel — making campaign delivery end-to-end accessible from the browser.

---

## 2. Architecture

```
[ Marketing Nav ] ──► [ /marketing/dispatches ]
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [ Dispatch Table ]               [ CreateDispatchSheet ]
   - Status badge                    - Name input
   - Segment name                    - Segment picker
   - Sent/failed progress bar        - Template picker
   - Schedule / Cancel actions       - Send now / Schedule toggle

```

---

## 3. API Client Methods

**File:** `apps/admin/src/lib/api/client.ts`

Add a `dispatches` namespace to the `api` object:

```typescript
dispatches: {
  list(params?: Record<string, string>, options?: { tenantId?: string | null }) {
    return request<{ data: CampaignDispatch[]; total: number }>(
      `/marketing/dispatches${buildQuery(params)}`,
      options ?? {},
    );
  },
  get(id: string, options?: { tenantId?: string | null }) {
    return request<CampaignDispatch>(`/marketing/dispatches/${id}`, options ?? {});
  },
  create(data: CreateDispatchPayload, options?: { tenantId?: string | null }) {
    return request<CampaignDispatch>("/marketing/dispatches", {
      method: "POST",
      body: JSON.stringify(data),
      ...options,
    });
  },
  schedule(id: string, scheduledAt: string, options?: { tenantId?: string | null }) {
    return request<CampaignDispatch>(`/marketing/dispatches/${id}/schedule`, {
      method: "POST",
      body: JSON.stringify({ scheduled_at: scheduledAt }),
      ...options,
    });
  },
  cancel(id: string, options?: { tenantId?: string | null }) {
    return request<CampaignDispatch>(`/marketing/dispatches/${id}/cancel`, {
      method: "POST",
      ...options,
    });
  },
},
```

### Types

```typescript
interface CampaignDispatch {
  id: string;
  tenant_id: string;
  name: string;
  template_id: string;
  segment_id: string;
  status: "draft" | "scheduled" | "processing" | "completed" | "failed";
  scheduled_at: string | null;
  sent_count: number;
  failed_count: number;
  total_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface CreateDispatchPayload {
  name: string;
  template_id: string;
  segment_id: string;
  scheduled_at?: string | null;
  send_immediately?: boolean;
}
```

---

## 4. React Query Hooks

**File:** `apps/admin/src/features/marketing/hooks/use-dispatches.ts`

- `useDispatches(params?, tenantId?)` — paginated list with status filter
- `useDispatch(id, tenantId?)` — single dispatch detail
- `useCreateDispatch(tenantId?)` — mutation, invalidates dispatches + segments queries
- `useCancelDispatch(tenantId?)` — mutation
- `useScheduleDispatch(tenantId?)` — mutation

---

## 5. Components

### DispatchList

**File:** `apps/admin/src/features/marketing/components/dispatch-list.tsx`

Table columns: Name, Segment, Status (badge), Progress (sent/total bar), Schedule, Actions.

Actions per row:

- **Cancel** — button visible when `status === "scheduled"`, calls `POST /dispatches/{id}/cancel`
- **Schedule** — date picker modal, calls `POST /dispatches/{id}/schedule`

### CreateDispatchSheet

**File:** `apps/admin/src/features/marketing/components/create-dispatch-sheet.tsx`

Form fields:

- Name (text input)
- Segment (select/combobox — fetches saved segments)
- Template (select/combobox — fetches campaign templates)
- Send now / Schedule toggle (send_immediately checkbox + datetime picker)

On submit: calls `POST /dispatches`, refetches list.

---

## 6. Page Integration

**File:** `apps/admin/src/app/(app)/marketing/dispatches/page.tsx` (new)

Layout: header with title + "New Campaign" button, dispatch list table, create sheet dialog.

---

## 7. Files Changed

| File                                                                     | Change                             |
| ------------------------------------------------------------------------ | ---------------------------------- |
| `apps/admin/src/lib/api/client.ts`                                       | Add `dispatches` namespace + types |
| `apps/admin/src/features/marketing/hooks/use-dispatches.ts`              | **New** — hooks                    |
| `apps/admin/src/features/marketing/components/dispatch-list.tsx`         | **New** — table                    |
| `apps/admin/src/features/marketing/components/create-dispatch-sheet.tsx` | **New** — creation form            |
| `apps/admin/src/app/(app)/marketing/dispatches/page.tsx`                 | **New** — page                     |
