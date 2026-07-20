# Campaign Dispatch Admin UI — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-19-campaign-dispatch-ui.md`

---

## Step 1 — API Client & Types

**File:** `apps/admin/src/lib/api/client.ts`

Add `CampaignDispatch`, `CreateDispatchPayload` types and `dispatches` namespace.

---

## Step 2 — React Query Hooks

**File:** `apps/admin/src/features/marketing/hooks/use-dispatches.ts` (new)

```bash
mkdir -p apps/admin/src/features/marketing/hooks
```

Five hooks: `useDispatches`, `useDispatch`, `useCreateDispatch`, `useCancelDispatch`, `useScheduleDispatch`.

---

## Step 3 — Dispatch List Component

**File:** `apps/admin/src/features/marketing/components/dispatch-list.tsx` (new)

Table with status badges, progress bars, schedule/cancel actions.

---

## Step 4 — Create Dispatch Sheet

**File:** `apps/admin/src/features/marketing/components/create-dispatch-sheet.tsx` (new)

Form: name, segment picker, template picker, send now / schedule toggle.

---

## Step 5 — Page Shell

**File:** `apps/admin/src/app/(app)/marketing/dispatches/page.tsx` (new)

```bash
mkdir -p apps/admin/src/app/\(app\)/marketing/dispatches
```

Header + list + create sheet.

---

## Step 6 — Verify

```bash
pnpm --filter admin exec tsc --noEmit
pnpm vitest run --project admin
```
