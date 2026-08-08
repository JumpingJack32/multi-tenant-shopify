# CORS Wildcard Subdomain Support — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-08-08-cors-wildcard-subdomains.md`
**Status:** Approved

---

## Step 1 — `src/core/config.py`

Add the optional regex field:

```python
allowed_origins: str = "*"
allowed_origin_regex: str | None = None   # NEW
```

No change to `allowed_origins` type — `main.py`'s `.split(",")` parsing stays intact.

## Step 2 — `src/main.py`

Update `CORSMiddleware` declaration:

```python
origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
has_wildcard = "*" in origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=settings.allowed_origin_regex,
    allow_credentials=not has_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Tenant-ID"],
)
```

> **Correction to approved plan:** use `allow_origins=origins` (NOT `[] if has_wildcard else origins`). Passing `[]` when `has_wildcard` makes Starlette's `allow_all_origins=False` (since `is_allowed_origin` short-circuits only on `"*" in allow_origins`), rejecting every origin when no regex is configured — a dev regression. Keeping `origins` preserves the wildcard allow-all dev fallback and adds regex on top.

```

## Step 3 — Tests

New `services/backend-api/tests/test_cors.py` verifying:

- Preflight (`OPTIONS`) from `https://tenant-a.amoagou.com` with `allow_origin_regex` set → `Access-Control-Allow-Origin` echoes origin, `Access-Control-Allow-Credentials: true`
- Exact-origin match (`http://localhost:3000`) still works alongside regex
- Unauthorized origin → no `Access-Control-Allow-Origin` header
- `has_wildcard` mode: `allowed_origins="*"` → allow-all, credentials header omitted

Build the regex-aware middleware in a helper or use TestClient with the app's real middleware config. Approach: construct a small FastAPI app in the test that adds `CORSMiddleware` with the same params, avoiding Doppler-dependent settings instantiation.

## Step 4 — Verify + branch/PR

- Run `pytest services/backend-api/tests/test_cors.py` then full backend suite (expect 266 + new)
- Feature branch: `fix/cors-wildcard-subdomains` from `main`
- Commit + push + open PR
- Doppler: set `ALLOWED_ORIGIN_REGEX` (documented in spec; may be done by user via dashboard)

---

## Verification

- Backend pytest suite green (new `test_cors.py` + no regressions)
- PR created against `main`
```
