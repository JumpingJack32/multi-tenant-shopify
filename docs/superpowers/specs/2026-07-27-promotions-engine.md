# Promotions & Discount Engine

**Goal:** Allow admins to create coupon codes and discount rules (percentage, fixed amount) with usage limits, schedule constraints, and real-time checkout validation.

---

## 1. Model

```python
class Promotion(BaseModel, table=True):
    __tablename__ = "promotions"

    tenant_id: UUID = Field(foreign_key="tenants.tenant_id", index=True)
    code: str = Field(max_length=50, index=True)
    type: str = Field(max_length=20)            # "percentage" | "fixed_amount"
    value: int = Field(ge=0)                    # Percentage (500 = 5%) or cents (2000 = $20)
    min_subtotal: Optional[int] = Field(None, ge=0)  # Minimum cart in cents
    max_uses: Optional[int] = Field(None, ge=0)
    uses_count: int = Field(default=0)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = Field(default=True)
```

### Validation rules (service layer)

- Code is active and within start/end dates
- `uses_count < max_uses`
- Cart subtotal >= `min_subtotal`
- Percentage discounts: 0 < value <= 10000 (100%)
- Fixed amount discounts: value <= cart total

---

## 2. API Endpoints

### Admin CRUD

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/promotions` | List all promotions for tenant |
| `POST` | `/admin/promotions` | Create promotion |
| `PUT` | `/admin/promotions/{id}` | Update promotion |
| `DELETE` | `/admin/promotions/{id}` | Soft-delete (deactivate) |

### Storefront validation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/storefront/{tenant}/promotions/validate` | Validate code + compute discount |

Request: `{ "code": "SUMMER20", "subtotal": 5000, "items": [...] }`
Response: `{ "valid": true, "discount": 500, "type": "percentage", "value": 20 }`

---

## 3. Cart & Checkout Integration

- **Cart drawer**: promo code input with "Apply" button → calls validate endpoint → shows discount line
- **Checkout**: pass discount amount to order creation (store as `discount` field on `Order`, already exists)
- **Stripe Checkout**: deducted from total before creating session

---

## 4. Admin UI

- Page at `apps/admin/src/app/(app)/discounts/promotions/page.tsx`
- Table: code, type, value, usage (uses_count / max_uses), dates, active toggle
- Create/edit dialog: code, type select, value, min subtotal, max uses, date range

---

## 5. Files Changed

| File | Change |
|------|--------|
| `src/orm/models/promotion.py` | New: `Promotion` model |
| `src/orm/schemas/promotion.py` | New: request/response schemas |
| `src/routes/promotions.py` | New: admin CRUD + storefront validate endpoints |
| `src/services/discount_service.py` | New: validation + calculation logic |
| `apps/admin/src/app/(app)/discounts/promotions/` | New: admin management page |
| `apps/storefront/src/components/storefront/cart-drawer.tsx` | Update: promo code input + discount line |
