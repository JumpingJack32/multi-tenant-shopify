# CORS Wildcard Subdomain Support

**Goal:** Allow credentialed cross-origin requests from platform subdomains (e.g. `https://tenant-a.amoagou.com`, `https://admin.amoagou.com`) without manually listing each domain. Starlette's `CORSMiddleware` does not support `*.` wildcards in `allow_origins` when `allow_credentials=True`, so we add `allow_origin_regex`.

---

## 1. Problem

- FastAPI/Starlette `CORSMiddleware` rejects `https://*.amoagou.com` in `allow_origins` — it's treated as a literal hostname.
- Credentialed requests (Clerk bearer tokens, `guest_customer` cookies, Stripe portal redirects) require `allow_credentials=True`, which forbids the bare `*` origin.
- Static exact-origin lists don't scale per tenant subdomain.

---

## 2. Fix

### 2a. `src/core/config.py`

Add an optional regex field (lower_case convention; Pydantic maps `ALLOWED_ORIGIN_REGEX` → `allowed_origin_regex`):

```python
allowed_origins: str = "*"
allowed_origin_regex: str | None = None   # NEW
```

### 2b. `src/main.py`

Pass the regex to `CORSMiddleware`:

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

> **Note:** `allow_origins` is passed unchanged (not `[] if has_wildcard else origins`). Starlette's `is_allowed_origin` only returns allow-all when `"*" in allow_origins`; passing `[]` in wildcard mode would make `allow_all_origins=False` and reject _every_ origin when no regex is set (dev). Keeping `origins` preserves the existing dev fallback exactly while adding regex support.

When `allow_origins` is `*`, dev behavior is unchanged (allow-all, `allow_credentials=False`); when exact origins are set, both exact list and regex apply with credentials.

### 2c. Doppler

Set the bare regex (no `r"..."`, no quotes):

```bash
doppler secrets set ALLOWED_ORIGIN_REGEX="https://(?:[a-z0-9-]+\.)?amoagou\.com"
```

Keep `ALLOWED_ORIGINS` for exact domains (e.g. localhost dev).

---

## 3. Behavior

| Origin                         | Match      | Credentials    |
| ------------------------------ | ---------- | -------------- |
| `http://localhost:3000`        | exact list | true           |
| `https://admin.amoagou.com`    | regex      | true           |
| `https://tenant-a.amoagou.com` | regex      | true           |
| `https://unauthorized.com`     | none       | header omitted |

---

## 4. Future: custom apex domains

When tenants bring their own domains (`https://acme-store.com`), implement a dynamic CORS middleware that queries tenant domain records (cached in Redis) at preflight time. Out of scope here.
