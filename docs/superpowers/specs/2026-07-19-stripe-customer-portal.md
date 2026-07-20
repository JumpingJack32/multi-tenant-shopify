# Stripe Customer Portal — Specification (Revised)

> **Status:** Draft

---

## 1. Changes Across All Adapter Methods

Every adapter method that calls the `stripe` Python SDK must wrap synchronous calls in `anyio.to_thread.run_sync` to prevent event loop blocking.

### Pattern

```python
import anyio

async def some_method(self, ...):
    def _sync():
        stripe.api_key = settings.stripe_secret_key
        return stripe.SomeResource.create(...)
    return await anyio.to_thread.run_sync(_sync)
```

This applies to **three** adapter methods:

| Method                                                  | SDK Calls                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `CheckoutSessionAdapter.create_checkout`                | `stripe.checkout.Session.create`                                                           |
| `CheckoutSessionAdapter.handle_event`                   | `stripe.Webhook.construct_event`                                                           |
| `CheckoutSessionAdapter.create_customer_portal_session` | `stripe.Customer.search`, `stripe.Customer.create`, `stripe.billing_portal.Session.create` |
| `PaymentIntentAdapter.create_checkout`                  | `stripe.PaymentIntent.create`                                                              |
| `PaymentIntentAdapter.handle_event`                     | `stripe.Webhook.construct_event`, `stripe.PaymentIntent.retrieve`                          |

---

## 2. Customer Lookup via Search API

Replace the `stripe.Customer.list(email=..., limit=10)` iteration with Stripe's `search()` API, which supports metadata filtering server-side:

```python
def _sync_portal_flow() -> str:
    stripe.api_key = settings.stripe_secret_key

    query = f"email:'{customer_email}' AND metadata['tenant_id']:'{tenant_id}'"
    results = stripe.Customer.search(query=query)

    if results.data:
        customer = results.data[0]
    else:
        customer = stripe.Customer.create(
            email=customer_email,
            metadata={"tenant_id": str(tenant_id)},
        )

    session = stripe.billing_portal.Session.create(
        customer=customer.id,
        return_url=return_url,
    )
    return session.url
```

This is single-query, indexed on Stripe's side, and correctly scoped by `tenant_id` — no duplicates, no missed customers.

---

## 3. Auth: Guest-Token-Gated Access

Since the storefront uses guest checkout, the portal endpoint is secured by verifying the email against a recent order under the same tenant, not by global auth.

### Request Schema

```python
class CustomerPortalRequest(BaseModel):
    customer_email: str
```

### Endpoint Logic

```python
@router.post("/{tenant_slug}/customer-portal")
async def create_customer_portal(
    tenant_slug: str,
    payload: CustomerPortalRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    tenant = await _resolve_tenant(db, tenant_slug)

    # Verify this email has a completed order for this tenant
    from src.orm.models.order import Order
    stmt = select(Order.id).where(
        Order.tenant_id == tenant.tenant_id,
        Order.customer_email == payload.customer_email,
        Order.status.in_([OrderStatus.PAID, OrderStatus.PENDING_PAYMENT]),
    ).limit(1)
    order = (await db.exec(stmt)).one_or_none()
    if not order:
        raise HTTPException(status_code=403, detail="No active orders found for this email")

    adapter = get_stripe_adapter()
    base_url = str(request.base_url).rstrip("/")
    return_url = f"{base_url}/{tenant_slug}/account"

    url = await adapter.create_customer_portal_session(
        customer_email=payload.customer_email,
        tenant_id=tenant.tenant_id,
        return_url=return_url,
    )

    return {"url": url}
```

This prevents email fishing — the attacker must know both the victim's email AND the exact `tenant_slug`, and the victim must have a completed order. A low-probability brute force.

---

## 4. Frontend Hardening

```tsx
const handleBilling = async () => {
  setPortalLoading(true);
  try {
    const res = await fetch(
      `/api/v1/storefront/${tenantSlug}/customer-portal`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_email }),
      },
    );
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.detail || "Failed to launch billing portal");
    window.location.href = data.url;
  } catch (err) {
    console.error(err);
    // Toast or inline error
  } finally {
    setPortalLoading(false);
  }
};
```

---

## 5. Files Changed

| File                                                | Change                                                                                                                |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/services/stripe_adapter.py`                    | Wrap all SDK calls in `anyio.to_thread.run_sync`. Add `create_customer_portal_session` with `stripe.Customer.search`. |
| `src/routes/storefront.py`                          | Add `POST /{tenant_slug}/customer-portal` with Pydantic schema + order-verified guest access.                         |
| `apps/storefront/src/app/[tenant]/account/page.tsx` | **New** — Account page with "Manage Billing" button.                                                                  |
