# Abandoned Cart Recovery — Design

**Date:** 2026-07-13
**Status:** Draft

## Scope

Add programmable abandoned cart email recovery to the storefront. When a consumer adds items to their cart but does not complete checkout within 2 hours, the system sends a reminder email with a link to resume their cart.

The scope is intentionally narrow: capture email, detect abandonment, send one reminder. No multi-sequence drip campaigns, no SMS, no push notifications.

## 1. Architecture Overview

```
Consumer adds to cart → email captured → 2h idle
                                            │
                                     Background worker (poll)
                                     every 15 min via asyncio.create_task()
                                            │
                              ┌─────────────┴─────────────┐
                              │ carts where:               │
                              │  status = "active"         │
                              │  email IS NOT NULL         │
                              │  updated_at < NOW - 2h     │
                              │  last_reminded_at IS NULL  │
                              │  unsubscribed = false      │
                              └─────────────┬─────────────┘
                                            │
                                   EmailService.send()
                                   (Resend API via httpx)
                                            │
                              stamp last_reminded_at = NOW
```

The background worker follows the existing `asyncio.create_task()` pattern (matching `_exchange_rate_refresh_worker` in `main.py`). The DB is the source of truth so crash recovery is automatic.

## 2. Database Schema Changes

### Cart ORM Model

Add to existing `Cart` model (`services/backend-api/src/orm/models/cart.py`):

| Field              | Type                  | Nullable | Default    | Purpose                              |
| ------------------ | --------------------- | -------- | ---------- | ------------------------------------ |
| `email`            | `str`                 | Yes      | `None`     | Consumer's email for recovery        |
| `status`           | `CartStatus` enum     | No       | `"active"` | `active` / `completed` / `abandoned` |
| `last_reminded_at` | `datetime` (tz-aware) | Yes      | `None`     | Timestamp of last reminder sent      |
| `unsubscribed`     | `bool`                | No       | `False`    | Opt-out flag                         |
| `completed_at`     | `datetime` (tz-aware) | Yes      | `None`     | Timestamp of checkout completion     |

### CartStatus Enum

```python
class CartStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
```

### Cart Response Schema

**No changes needed** — email and status are internal fields not exposed to the storefront API response. They're set by the checkout endpoint and read by the background worker. The frontend never sees them.

### CheckoutRequest

Add to existing schema (`services/backend-api/src/orm/schemas/cart.py`):

```python
class CheckoutRequest(BaseModel):
    currency: str = "USD"
    customer_email: str | None = None  # NEW
    shipping_address: dict = Field(default_factory=dict)
    billing_address: dict = Field(default_factory=dict)
    notes: str | None = None
```

### Migration

New Alembic migration adding columns to `carts` table:

- `email VARCHAR` nullable
- `status VARCHAR NOT NULL DEFAULT 'active'`
- `last_reminded_at TIMESTAMPTZ` nullable
- `unsubscribed BOOLEAN NOT NULL DEFAULT FALSE`
- `completed_at TIMESTAMPTZ` nullable

Index on `(status, unsubscribed, email, updated_at)` for the worker query performance — equality-first columns (`status`, `unsubscribed`) before range column (`updated_at`) matches the query's WHERE clause order.

## 3. Checkout Flow Changes

### Backend: checkout handler

The checkout endpoint (`POST /carts/{cart_id}/checkout`) currently hard-deletes the cart. This changes to:

1. Accept `customer_email` in `CheckoutRequest`
2. Set `cart.email = customer_email` (if provided)
3. Set `cart.status = CartStatus.COMPLETED`
4. Set `cart.completed_at = datetime.now(timezone.utc)`
5. **Do not delete the cart row**
6. Create `Order` + `OrderItem` (as before)
7. Decrement inventory (as before)
8. Return order

The cart is retained for audit/recovery analysis. Expired carts (completed > 90 days) can be cleaned up by a separate housekeeping task later.

### Frontend: email capture

Add an email input field to the checkout form/process in the storefront. The email is sent as `customer_email` in the checkout request body.

**Placement:** In the cart drawer or on a checkout page, before the final "Place Order" action. Simple text input with email validation.

## 4. Email Service

### Interface

New file: `services/backend-api/src/services/email_service.py`

```python
class EmailService(ABC):
    @abstractmethod
    async def send_abandoned_cart(
        self,
        to_email: str,
        cart: dict,  # serialized cart data with items
        recovery_url: str,
        tenant_name: str,
        unsubscribe_token: str,
    ) -> bool: ...
```

### Implementation start: mock

Phase 1 ships with `LogEmailService` that only logs to console — zero API dependencies, works in development, lets us test the full pipeline without burning credits.

```python
class LogEmailService(EmailService):
    async def send_abandoned_cart(self, to_email, cart, recovery_url, tenant_name, unsubscribe_token):
        logger.info(
            "Abandoned cart email to %s for %s: %d items, recover at %s",
            to_email, tenant_name, len(cart.get("items", [])), recovery_url,
        )
        return True
```

### Phase 2: ResendEmailService

Swap the implementation once testing is done. Uses `resend` Python SDK or raw `httpx`:

```python
class ResendEmailService(EmailService):
    def __init__(self, api_key: str, from_email: str):
        self.api_key = api_key
        self.from_email = from_email

    async def send_abandoned_cart(self, to_email, cart, recovery_url, tenant_name, unsubscribe_token):
        # Render HTML template, send via Resend API
        ...
```

Tenant-specific `from_email` and `api_key` are stored in `Tenant.settings["email"]` JSON.

### Email Templates

Store HTML templates in `services/backend-api/src/templates/email/`:

```
templates/email/
  abandoned_cart.html      # Jinja2 template: product list, CTA, unsubscribe link
  abandoned_cart.txt       # Plaintext fallback
```

Template variables:

- `{{ tenant_name }}`
- `{{ items }}` — list of `{ product_name, variant_name, quantity, price, image_url }`
- `{{ total }}`
- `{{ recovery_url }}` — signed link back to cart
- `{{ unsubscribe_url }}` — one-click opt-out link

### Render + Send Flow

```
1. Worker finds abandoned cart
2. Fetch cart with items (eager-load variant + product)
3. Fetch tenant settings (name, logo, email config)
4. Generate recovery_url = f"https://{tenant_domain}/{slug}/cart/{cart_id}"
5. Generate unsubscribe_token = sign(cart_id, email, secret)
6. Render template → HTML
7. EmailService.send(to_email, subject, html)
8. On success → stamp last_reminded_at
```

## 5. Background Worker

### Scheduler

Append to the existing lifespan in `main.py`:

```python
async def _abandoned_cart_worker():
    while True:
        try:
            async with AsyncSession(engine) as db:
                service = AbandonedCartService(db, EmailService.create())
                await service.process_abandoned_carts()
        except Exception:
            logger.exception("Abandoned cart worker error")
        await asyncio.sleep(900)  # 15 minutes
```

### Idempotency & Race Condition Prevention (Nuance #2)

The worker must never double-email. Strategy:

1. **Single-cart SELECT FOR UPDATE**: Within a transaction, select candidate carts with `FOR UPDATE SKIP LOCKED`. This locks only the rows being processed and skips rows already locked by another worker tick.

2. **Commit before network I/O**: Stamp `last_reminded_at`, then **commit immediately** to release row locks and free the DB connection back to the pool _before_ making the email API call. If the email fails, the cart is already stamped and won't be picked up again until the 24h retry window (see point 3).

3. **24h cooldown**: The WHERE clause includes `(last_reminded_at IS NULL OR last_reminded_at < NOW() - INTERVAL '24 hours')`. If sending fails, the cart is retried the next day, not the next tick.

4. **Eager-load Tenant**: The query joins `Cart.tenant` to avoid N+1 queries when resolving tenant-specific email settings inside the loop.

```python
async def process_abandoned_carts(self):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=2)
    cooldown = datetime.now(timezone.utc) - timedelta(hours=24)

    stmt = (
        select(Cart)
        .options(selectinload(Cart.items), joinedload(Cart.tenant))
        .where(
            Cart.status == CartStatus.ACTIVE,
            Cart.email.isnot(None),
            Cart.unsubscribed == False,
            Cart.updated_at < cutoff,
            or_(
                Cart.last_reminded_at.is_(None),
                Cart.last_reminded_at < cooldown,
            ),
        )
        .order_by(Cart.updated_at.asc())
        .limit(50)
        .with_for_update(skip_locked=True)
    )

    carts = (await self.db.execute(stmt)).scalars().all()

    # Extract payloads and commit immediately — release locks before network I/O
    cart_payloads = []
    for cart in carts:
        cart.last_reminded_at = datetime.now(timezone.utc)
        cart_payloads.append({
            "id": cart.id,
            "email": cart.email,
            "items": [{"id": i.id, "variant_id": i.variant_id, "quantity": i.quantity} for i in cart.items],
            "tenant": cart.tenant,
            "tenant_slug": cart.tenant.slug,
        })

    await self.db.commit()  # release FOR UPDATE locks

    # Network I/O — safely outside the DB transaction
    for payload in cart_payloads:
        try:
            await self.email_service.send_abandoned_cart(
                to_email=payload["email"],
                cart=payload,
                recovery_url=build_recovery_url(payload["tenant_slug"], payload["id"]),
                tenant_name=payload["tenant"].name,
                unsubscribe_token=sign_unsubscribe_token(payload["id"], payload["email"]),
            )
        except Exception:
            logger.exception(
                "Failed to send reminder for cart %s, will retry in 24h",
                payload["id"],
            )
```

### Abandoned vs Active

The status transition to `"abandoned"` happens lazily: once `last_reminded_at` is set, the audit/analytics layer can mark it. For MVP, we don't need a separate status transition — the presence of `last_reminded_at` + `email` + `updated_at < cutoff` is sufficient.

## 6. Frontend Cart ID After Checkout (Nuance #1)

When checkout succeeds, the frontend **must** clear its local cart reference and generate a fresh session.

### Current state

The cart cookie (`cart_{tenantSlug}`) has a 30-day TTL. The checkout handler calls `router.push(/checkout/success)` but never clears the cookie.

### Required change

In the checkout success handler:

1. Clear the `cart_{tenantSlug}` cookie (set expiry to past date)
2. Clear `localStorage` cart ID
3. Reset zustand cart store to initial state

```typescript
// In the checkout mutation's onSuccess:
const clearCartCookie = (tenantSlug: string) => {
  document.cookie = `cart_${tenantSlug}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
};
localStorage.removeItem(`cart_${tenantSlug}`);
```

This prevents the frontend from holding a stale `"completed"` cart ID and getting 404s on subsequent add-to-cart requests.

### Edge case: User re-visits with stale cart

If a user somehow re-uses the cookie (e.g., bookmark with the old cart ID), the `GET /carts/{id}` endpoint returns the cart with `status: "completed"`. The frontend handles this by treating a completed cart as empty — show "Your cart is empty" state and generate a new cart on first add-to-cart.

## 7. One-Click Unsubscribe (Nuance #3)

### Database

`Cart.unsubscribed: bool = False` — set to `True` when the user clicks the unsubscribe link in the email.

### Unsubscribe endpoint

```
POST /api/v1/public/carts/unsubscribe/{token}
```

The `token` is a signed JWT or HMAC containing `cart_id` + `email`. No auth required — the token itself is the authorization.

```python
@router.post("/carts/unsubscribe/{token}")
async def unsubscribe_cart_recovery(token: str, db: AsyncSession = Depends(get_db)):
    payload = verify_unsubscribe_token(token)
    cart = await db.get(Cart, payload["cart_id"])
    if cart and cart.email == payload["email"]:
        cart.unsubscribed = True
        await db.commit()
    return {"ok": True}
```

### Unsubscribe link in email

```
{{ unsubscribe_url }}
→ https://{domain}/api/v1/public/carts/unsubscribe/{signed_token}
```

No user-facing page needed for MVP — the API call sets `unsubscribed = True` and returns a simple "You've been unsubscribed" JSON or redirects to a static confirmation page.

### Resend-level opt-out

Resend provides automatic unsubscribe header injection (`List-Unsubscribe`) for its higher tiers. If using Resend Pro, the email client shows an "Unsubscribe" button natively, and Resend handles the suppression list. The DB-level flag is still useful as an application-level check to stop sending before hitting the API.

## 8. AbandonedCartService

New service class that encapsulates the query + send logic:

```python
class AbandonedCartService:
    def __init__(self, db: AsyncSession, email_service: EmailService):
        self.db = db
        self.email_service = email_service

    async def process_abandoned_carts(self) -> int:
        """Find and notify. Returns count of reminders sent."""
        ...
```

Testable in isolation by injecting a mock `EmailService` and a test DB session.

## 9. Recovery URL

The recovery URL links back to the storefront with the cart ID as a query parameter:

```
https://{tenant_domain}/{tenant_slug}/cart?recover={cart_id}
```

### Frontend handling

1. On page load, read `recover` query param
2. If present and no existing cart cookie exists → `GET /carts/{cart_id}` to verify the cart is still `status=active`
3. If valid → set cart ID cookie + load cart normally
4. If invalid (completed, not found) → show empty cart, ignore param

This handles the common recovery scenarios:

| Scenario                     | Cookie exists? | `recover` param | Behavior                  |
| ---------------------------- | -------------- | --------------- | ------------------------- |
| Same browser, within 30d     | Yes            | Optional        | Cart loads from cookie    |
| Same browser, cookie expired | No             | Present         | Query param restores cart |
| Different device             | No             | Present         | Query param restores cart |
| Cart already completed       | No/Present     | Present         | Show empty cart (safe)    |

### No signed token for MVP

The cart is already authenticated by its UUID (unguessable). An attacker who knows the cart ID can see its contents, but cannot modify or checkout without the email address (added to the cart).

**Limitation:** If the user forwards their email to someone else, that person can load the cart contents. For MVP this is acceptable (cart data is low-sensitivity). A future enhancement should add an HMAC signature to the recovery URL (same pattern as the unsubscribe token) so only the email recipient can access it.

### Future: HMAC-signed recovery token

Add `?token={hmac(cart_id + email, secret)}` to the recovery URL. The frontend verifies the token before loading the cart. This prevents forwarded-email access without adding auth infrastructure.

## 10. Testing Strategy

### Unit Tests

| Test                                    | Scope                  | What it verifies                               |
| --------------------------------------- | ---------------------- | ---------------------------------------------- |
| `test_checkout_sets_email`              | Checkout endpoint      | `customer_email` stored on cart after checkout |
| `test_checkout_status_completed`        | Checkout endpoint      | Cart status changes to `completed`             |
| `test_checkout_preserves_cart`          | Checkout endpoint      | Cart row not deleted after checkout            |
| `test_worker_queries_correct`           | `AbandonedCartService` | Correct WHERE clause, old enough carts only    |
| `test_worker_skips_no_email`            | `AbandonedCartService` | Carts without email not selected               |
| `test_worker_skips_unsubscribed`        | `AbandonedCartService` | `unsubscribed=True` carts not selected         |
| `test_worker_skips_recently_reminded`   | `AbandonedCartService` | Carts reminded within 24h not re-selected      |
| `test_worker_sends_email`               | `AbandonedCartService` | Email sent for qualifying cart                 |
| `test_worker_stamps_last_reminded`      | `AbandonedCartService` | `last_reminded_at` set after send              |
| `test_worker_no_double_email`           | `AbandonedCartService` | `SELECT FOR UPDATE` prevents race              |
| `test_unsubscribe_endpoint`             | Public endpoint        | Token verification + flag set                  |
| `test_unsubscribe_wrong_cart`           | Public endpoint        | Invalid token rejected                         |
| `test_email_service_interface`          | `LogEmailService`      | Mock sends are logged                          |
| `test_frontend_clears_cart_on_checkout` | Frontend               | Cookie cleared after successful checkout       |

### Integration Tests

- Full checkout flow with `customer_email` set
- Background worker picking up carts from seeded DB
- Unsubscribe flow from email link to Cart update

### Frontend Tests

- Email input renders and validates
- Cookie cleared on checkout success response
- Completed cart displays as empty

## 11. Implementation Order

1. **Database migration** — Add columns to `carts` table
2. **Update Cart ORM model** — Add `email`, `status`, `last_reminded_at`, `unsubscribed`, `completed_at`
3. **Update checkout endpoint** — Accept `customer_email`, status → `completed`, no hard-delete
4. **Frontend: email capture** — Add email input to checkout flow
5. **EmailService** — Interface + `LogEmailService` implementation
6. **AbandonedCartService** — Worker query + send logic
7. **Background worker** — `asyncio.create_task()` in lifespan
8. **Unsubscribe endpoint** — Public POST endpoint with token verification
9. **Email template** — HTML + plaintext for abandoned cart
10. **ResendEmailService** — Production implementation (phase 2)
11. **Frontend: cart cleanup** — Clear cookie + localStorage on checkout success
12. **Tests** — Unit + integration for all new code

## 12. Future Considerations

- **Multi-sequence campaigns**: 2h → 24h → 72h reminders. Requires adding `reminder_count` and `next_reminder_at` fields.
- **SMS recovery**: Twilio integration alongside email.
- **Voucher/incentive**: Include a discount code in the second reminder.
- **Cart snapshot at abandonment**: Store the cart's total at the time of abandonment for reporting.
- **Rate locking**: Persist exchange rate used during cart creation so the total doesn't shift between abandonment and recovery.
- **HMAC-signed recovery URLs**: Prevent forwarded-email access by signing the recovery URL with the cart ID + email.
