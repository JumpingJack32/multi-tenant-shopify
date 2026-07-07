---
name: clerk-fastapi-sync
description: Reusable instructions for setting up Clerk  and JWT validation in FastAPI
---

# Project Overview

Next.js Turborepo frontend with a Python FastAPI backend.
Database is local Supabase PostgreSQL managed via Orbstack.
Authentication is handled by Clerk.

## Clerk Integration Workflow

When implementing Clerk authentication endpoints or webhooks in FastAPI, ensure the following steps are performed:

1. Always add `pyjwt` or `python-jose` for verifying the Clerk JWT token.
2. Read the Clerk JSON Web Key Sets (JWKS) to validate keys locally.
3. Map the incoming Clerk `user.created` webhook payload variables to match the exact schema of the local Supabase Postgres database.
4. Set the `id` field in the database table to `TEXT` or `VARCHAR`.

## Project Context

This is a Monorepo containing a Next.js frontend and a Python FastAPI backend.

## Tech Stack

- Frontend: Next.js (Turborepo)
- Backend: Python FastAPI
- Database: Local Supabase PostgreSQL (via Orbstack)
- Authentication: Clerk Auth

## Crucial Rules

- Use alphanumeric text strings for User IDs (Clerk ID format), NOT Postgres UUIDs.
- Check the FastAPI `requirements.txt` or `pyproject.toml` before adding Python dependencies.
- Never run manual database migrations; use the Supabase CLI.

## Global Coding Rules

- Do not mix Next.js and FastAPI dependencies.
- Always use alphanumeric text/varchar for User IDs to support Clerk.

## 🐍 Python & FastAPI Integration Constraints

When managing, creating, or editing files within `services/backend-api/`:

1. **Environment Separation**: The Python backend must live in `services/backend-api` and use its own isolated virtual environment (`.venv`).
2. **Clerk Authentication Method**:
   - Do not pass JWTs through frontend-focused libraries.
   - The backend must accept a Bearer token in the `Authorization` header.
   - Use the official `clerk-backend-api` Python SDK to verify the session token.
3. **FastAPI Route Architecture**:
   - Enforce PEP 593 `Annotated` types for all FastAPI dependencies.
   - Authentication logic must be abstracted into a clean, reusable dependency injection function (e.g., `Depends(get_current_user)`).
   - Put the authentication check at the API route layer, keeping core business logic decoupled.
4. **Environment Variables**:
   - `CLERK_SECRET_KEY`: Must be loaded into the Python environment from `services/backend-api/.env.local`.
   - Never hardcode keys or expose secret keys in client-facing code.

## 👥 Multi-App Authentication & Role Constraints

When managing, creating, or editing configurations for `apps/admin` or `apps/storefront`:

1. **Shared Logic Isolation**: Shared components (like customized login buttons or user state sync hooks) must live in `packages/auth/`. Do not duplicate auth layouts between `apps/storefront` and `apps/admin`.
2. **Admin-Specific Route Protection**:
   - `apps/admin/` must use a strict middleware guard configuration.
   - Use Clerk's `orgMetadata` or user `publicMetadata` to check for custom roles (e.g., `role: "admin"`).
   - If an authenticated user lacks the admin flag, the middleware must instantly redirect them back to a designated unauthorized page or back to `apps/web`.
3. **Environment Separation**:
   - Each app must maintain its own `.env` to configure different redirects.
   - `apps/admin/` must point its redirect keys (`NEXT_PUBLIC_CLERK_SIGN_IN_URL`) to `/admin/sign-in` or its respective auth layout subpaths.
