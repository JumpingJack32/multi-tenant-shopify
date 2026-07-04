# Project Context - Reference File

## Secrets Management

- Project uses **Doppler** for secrets management — NEVER read `.env` files directly
- All secrets (including `DATABASE_URL`) come from Doppler environment variables

## Database

- **Connection**: Use `DATABASE_URL` from Doppler environment variable — NEVER hardcode connection strings
- **Live DB**: Supabase PostgreSQL on port 54322 (container: `supabase_db_multi-tenant-shopify`)
- **Seeding**: Use `ON CONFLICT DO NOTHING` — never delete existing data
- **Enum values are UPPERCASE**: `ACTIVE`, `PUBLISHED`, `CONFIRMED`, `PAID`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `REFUNDED`, `PENDING`
- **Live schema differs from** `packages/db/migrations/0001_initial.sql` — rely on actual DB columns

## Project Structure

- Storefront app is at `apps/storefront` (NOT `apps/web`)
- Backend API is at `services/backend-api`
- Use pnpm workspaces + Turborepo
- Backend uses `uv` for venv management

## TypeScript

- TS 6.0.3 is installed. The `ignoreDeprecations: "6.0"` option is silently accepted in packages extending `base.json` but causes TS5103 in apps extending `nextjs.json`. Admin tsconfig omits it.
- Clerk v7 uses `proxy.ts` (not `middleware.ts`) at app source root for middleware — Next.js auto-discovers it as middleware.
- `@/` import alias works via `nextjs.json` paths (`"@/*": ["./*"]`). Apps override in their own tsconfig with `"@/*": ["./src/*"]`.

## Asyncpg

- DSN prefix must be `postgresql://` — NOT `postgresql+asyncpg://`

## SQLModel

- `db.exec()` replaces the deprecated `db.execute()` — use `.one_or_none()` instead of `.scalar_one_or_none()`, and `.all()` instead of `.scalars().all()`
- `exec()` returns `ScalarResult[T]` directly; `execute()` returned `Result[T]` requiring `.scalars()`

## Media & Cloudinary

- **Storefront** (`apps/storefront`): uses `next-cloudinary` with `<CldImage>` for optimized CDN image delivery. Never uploads directly.
- **Admin** (`apps/admin`): will use `POST /api/v1/media/upload-signature` (protected by `require_admin` auth) to get signed upload params, then uploads directly to Cloudinary. Never proxies files through the backend.
- **Backend** (`services/backend-api`): hosts `POST /api/v1/media/upload-signature` (generates signed upload params) and `DELETE /api/v1/media/asset` (signed delete). Never receives or proxies file data.
- **Upload flow**: Browser → signed params from backend → direct upload to Cloudinary CDN → URL saved to product record. Backend never touches the binary.
- **Env vars**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (backend, Doppler). `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (storefront, Doppler).
- **Package**: `next-cloudinary` in storefront, `cloudinary` (PyPI) in backend.

## GitHub

- Repo: JumpingJack32/multi-tenant-shopify (private)
- CI: GitHub Actions — runs lint, typecheck, test, coverage on push/PR to main
- Note: agent lacks GitHub CLI auth; CI status must be checked manually
