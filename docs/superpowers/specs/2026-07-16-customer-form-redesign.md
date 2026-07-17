# Customer Form Redesign — Specification

> **Status:** Draft  
> **Based on:** Add Customer mockup, existing Customer model + CustomerAddress model

---

## 1. Overview

Replace the current minimal `AddCustomerDialog` with a dual-mode system:

1. **Quick-add dialog** — minimal email + name (existing pattern, kept for speed)
2. **Full-page form** — `/customers?view=add` with all sections (same pattern as products `/products?view=add`)

Existing dialogs (`CustomersHeader` "Add Customer", import) remain unchanged.

---

## 2. Data Model Changes

**File:** `src/orm/models/order.py` — extend `Customer`

Add fields to support the new form:

```python
language: str = Field(default="en", max_length=10)
email_marketing_consent: bool = Field(default=False)
sms_marketing_consent: bool = Field(default=False)
tax_exempt: bool = Field(default=False)
tax_exempt_reason: str | None = Field(default=None, max_length=255)
```

**File:** `src/orm/models/order.py` — extend `CustomerAddress`

```python
company: str | None = Field(default=None, max_length=255)
phone: str | None = Field(default=None, max_length=50)
```

**Migration:** `drop_all + create_all` on next reseed (same pattern as Phase 1).

---

## 3. Backend: Schema Updates

**File:** `src/orm/schemas/customer.py`

Extend `CustomerCreate` with new fields:

```python
class CustomerCreate(PydanticBaseModel):
    email: Optional[str] = Field(None, max_length=255)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None  # Customer-level contact phone
    email_subscription_status: Optional[str] = None
    email_subscription_type: Optional[str] = None
    tags: dict = Field(default_factory=dict)
    notes: Optional[str] = None
    language: str = "en"
    email_marketing_consent: bool = False
    sms_marketing_consent: bool = False
    tax_exempt: bool = False
    tax_exempt_reason: Optional[str] = None
    # Address fields (creates CustomerAddress row inline)
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    address_city: Optional[str] = None
    address_province: Optional[str] = None
    address_postal_code: Optional[str] = None
    address_country: Optional[str] = None
    address_company: Optional[str] = None
    address_phone: Optional[str] = None  # Separate delivery contact phone
```

Extend `CustomerResponse` with new fields.

---

## 4. Backend: Route Update

**File:** `src/routes/customers.py` — modify `POST /customers/`

When address fields are provided in the request body, create both the `Customer` and a `CustomerAddress` row in the same transaction:

```python
@router.post("/customers/", response_model=CustomerResponse, status_code=201)
async def create_customer(body: CustomerCreate, db, tenant_id):
    # Require at least one identifier
    if not body.email and not body.phone:
        raise HTTPException(status_code=422, detail="Either email or phone is required")

    customer = Customer(
        tenant_id=tenant_id,
        email=body.email,
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,  # Customer-level contact phone
        language=body.language,
        email_marketing_consent=body.email_marketing_consent,
        sms_marketing_consent=body.sms_marketing_consent,
        tax_exempt=body.tax_exempt,
        tax_exempt_reason=body.tax_exempt_reason if body.tax_exempt else None,
        notes=body.notes,
        tags=body.tags,
    )
    db.add(customer)
    await db.flush()  # Populates customer.id

    # Only create address if at least one meaningful field is filled
    has_address = any([body.address_line1, body.address_city, body.address_postal_code, body.address_country])
    if has_address:
        address = CustomerAddress(
            customer_id=customer.id,
            tenant_id=tenant_id,
            address_type="shipping",
            line1=body.address_line1 or "",
            line2=body.address_line2 or "",
            city=body.address_city or "",
            province=body.address_province or "",
            postal_code=body.address_postal_code or "",
            country=body.address_country or "",
            company=body.address_company or "",
            phone=body.address_phone or None,  # Delivery contact phone
            is_default=True,
        )
        db.add(address)

    await db.flush()
    await db.refresh(customer)
    return customer
```

---

## 5. Frontend: Restructure Components

```
apps/admin/src/app/(app)/customers/
├── page.tsx                       ← unchanged (orchestrates list + dialogs)
├── components/
│   ├── add-customer-dialog.tsx     ← keep as quick-add (email + name + phone + status)
│   └── customer-form.tsx           ← NEW — full-page form (all sections)
```

### 5.1 Quick-Add Dialog (keep existing)

Minimal: Email, First Name, Last Name, Phone, Subscription Status. No changes needed.

### 5.2 Full-Page Form (new)

**File:** `apps/admin/src/components/customers/customer-form.tsx`

Render at `/customers?view=add`. Same navigation pattern as products (`/products?view=add`).

**Sections:**

| Section               | Components                         | Model Fields                                                                                                                      |
| --------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Customer Overview** | 2-column grid, Select, Checkbox    | `first_name`, `last_name`, `language`, `phone`, `email_marketing_consent`, `sms_marketing_consent`                                |
| **Primary Address**   | Collapsible country, 2-column grid | `address_line1`, `address_line2`, `address_city`, `address_province`, `address_postal_code`, `address_country`, `address_company` |
| **Tax Exemptions**    | Switch + Select                    | `tax_exempt`, `tax_exempt_reason`                                                                                                 |
| **Notes**             | shadcn Textarea                    | `notes`                                                                                                                           |
| **Tags**              | Tag input + suggested tags         | `tags`                                                                                                                            |

**shadcn components needed:** `Collapsible`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `Badge`, `Button`, `Input`, `Switch`

### 5.3 Page.tsx update

Add the `view === "add"` render block:

```typescript
{view === "add" && (
  <div className="mx-auto max-w-3xl">
    <CustomerForm onSubmit={handleCreate} onCancel={() => router.push("/customers")} />
  </div>
)}
```

---

## 6. Wire Header Button

The "Add Customer" button in `CustomersHeader` already opens the quick-add dialog. Add a second entry in the dropdown or change the button to navigate to the full form. For now, keep the button opening the dialog (quick-add) and add a "New Customer (Full)" option in the import dropdown.

---

## 7. Files Changed

| File                                                    | Change                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/orm/models/order.py`                               | Add `language`, consents, tax fields to `Customer`; `company`, `phone` to `CustomerAddress` |
| `src/orm/schemas/customer.py`                           | Extend `CustomerCreate` with all new fields + address sub-fields                            |
| `src/routes/customers.py`                               | `POST /customers/` creates address row when provided                                        |
| `seed_database.py`                                      | Update customer INSERT for new columns                                                      |
| `apps/admin/src/components/customers/customer-form.tsx` | **New** — full-page form                                                                    |
| `apps/admin/src/app/(app)/customers/page.tsx`           | Add `view === "add"` render block                                                           |
| `packages/tenant-orm/src/types.ts`                      | Update `Customer` interface                                                                 |
| `packages/tenant-orm/src/schemas/tenant.ts`             | Update Zod schema                                                                           |

---

## 8. Future-Proofing: `is_default` Multi-Address Handling

The initial address is created with `is_default=True`. When multi-address editing is added later, a service-layer check or DB trigger must ensure only one address per customer has `is_default=True`. For Phase 1, this is handled by the fact that only one address is ever created at customer creation time.

---

## 9. Out of Scope

- Language list — ship with `en` default, database-only config for now
- Country code phone prefix dropdown (`+1`, `+44`) — store as part of the phone string or defer to Phase 2
- Suggested tags — hardcode a small list in the component for now (`VIP`, `Wholesale`, `New-2026`, `Local`)
