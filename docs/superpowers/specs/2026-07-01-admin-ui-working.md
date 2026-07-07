# Admin UI — Make It Working

## Overview
Transform the admin dashboard from a static mockup into a functional, error-free interface where users can interact with data and navigation without the application breaking. Covers build fixes, error/loading polish, placeholder pages, and component tests.

## Execution Order
1. **A: Fix Build** — resolve the 1 TS error in `use-products.test.tsx`
2. **D: Functional Polish** — error banners, loading skeletons, empty states
3. **B: Features** — Orders page, Settings page, verify sidebar navigation
4. **C: Tests** — tenant-context, product-table, product-form, sign-in page

## Spec

### A — Fix Build
- **TS error**: `apps/admin/src/features/products/hooks/__tests__/use-products.test.tsx:40`
  - Mock data `{ id, name, slug, status }` missing required Product fields
  - Add: `tenant_id`, `description`, `sku`, `weight`, `weight_unit`, `is_active`, `created_at`, `updated_at`
- **Verify**: `pnpm dev` (root) starts without compilation errors — the root `package.json` wraps `doppler run -- pnpm turbo run dev`

### D — Functional Polish
- **API error banner**: When API calls to `localhost:8000` fail (tenant fetch, products CRUD), show an inline warning banner instead of crashing the page. Reuses existing pattern — catch in react-query's `onError` or render from query's `error` state.
- **Loading skeletons**: Dashboard `StatCard` already has pulse animation for loading state. Products table shows spinner. Verify these work in practice.
- **Empty states**: Products table already shows "No products found" when empty. Orders page needs the same pattern. Add "No results" for search with no matches.

### B — Features
- **Orders page** (`/orders`): Table with columns: customer email, status (badge), total, created date. Status filter dropdown. Pagination. Empty state when no orders. Follows same pattern as ProductTable.
- **Settings page** (`/settings`): Simple form — store name and slug inputs. Save button that calls API PATCH.
- **Sidebar nav**: Verify existing Orders and Settings links highlight correctly with `usePathname()`. No code changes expected — just verification.

### C — Tests
- **`tenant-context.test.tsx`**: Render provider, verify values accessible via `useTenantContext`, verify throws without provider. Mock Clerk and sessionStorage.
- **`product-table.test.tsx`**: Render rows from product data, verify loading spinner, verify empty state, verify onEdit/onDelete callbacks fire.
- **`product-form.test.tsx`**: Render form fields, validate required name triggers error, validate slug format, verify onSubmit fires with form data.
- **`sign-in-page.test.tsx`**: Render sign-in form, verify social login buttons present, verify email/password inputs, verify error state shown on failure.

## Files to Modify
| File | Workstream |
|---|---|
| `apps/admin/src/features/products/hooks/__tests__/use-products.test.tsx` | A |
| `apps/admin/src/app/(app)/orders/page.tsx` | B |
| `apps/admin/src/app/(app)/settings/page.tsx` | B |
| `apps/admin/src/components/layout/sidebar.tsx` | B (verify only) |
| `apps/admin/src/contexts/__tests__/tenant-context.test.tsx` | C (new) |
| `apps/admin/src/components/products/__tests__/product-table.test.tsx` | C (new) |
| `apps/admin/src/components/products/__tests__/product-form.test.tsx` | C (new) |
| `apps/admin/src/app/auth/sign-in/__tests__/sign-in-page.test.tsx` | C (new) |

## Exclusions
- Backend API (not in scope — assumes `localhost:8000` may be down)
- Full e-commerce checkout flow
- Product CRUD enhancements beyond what already exists
- CSS/styling improvements to existing components
