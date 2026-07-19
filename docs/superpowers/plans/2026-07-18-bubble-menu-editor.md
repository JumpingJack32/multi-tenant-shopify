# Campaign Template Editor — Implementation Plan (Revised)

**Spec:** `docs/superpowers/specs/2026-07-18-bubble-menu-editor.md`

---

## Step 1 — Clean Old Dependencies & Workspace Sync

```bash
# Navigate to admin and remove the old Vercel editor wrapper
cd apps/admin && pnpm remove @react-email/editor

# Sync your root monorepo lockfile
pnpm -w install
```

Note: `packages/editor` already had TipTap dependencies and `@radix-ui/react-popover` removed in a prior step. Verify with `pnpm ls` that only `react-email-editor` remains.

---

## Step 2 — Rewrite `packages/editor/src/index.tsx`

Replace the TipTap-based `TenantEditor` with the Unlayer wrapper from the spec (Section 5). Key behaviors:

- `hasInitializedRef.current = true` triggers immediately on first `handleReady` boot to freeze out re-entrant data loads.
- `memoizedOptions` isolates `displayMode: "email"` and deep-compares `mergeTags` array mutations to block iframe flash cycles.
- Save button calls `exportHtml` + `saveDesign` in sequence.

---

## Step 3 — Wire into Template Editor Page

**File:** `apps/admin/src/app/(app)/marketing/templates/[id]/page.tsx`

- Use named export dynamic import pattern (default export won't work — `TenantEditor` is a named export):

```tsx
const TenantEditor = dynamic(
  () => import("@repo/editor").then((mod) => mod.TenantEditor),
  { ssr: false },
);
```

- Swap the legacy `<Textarea>` for `<TenantEditor>`.
- Map `onSave(html, design)` to update local state and persist both `body_html` and `body_json` via the update mutation endpoint.

---

## Step 4 — Verify & Update Tests

```bash
# Static type checking
pnpm --filter admin exec tsc --noEmit

# Run admin tests — audit mock payloads to replace any raw Jinja2
# structural logic blocks ({% %}) with valid variable-only merge tags
# ({{ customerName }}) matching the new token constraints.
pnpm vitest run --project admin
```
