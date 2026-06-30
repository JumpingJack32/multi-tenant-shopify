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
