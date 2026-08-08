import csv
from datetime import datetime, timezone
import io
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func as sa_func, or_
from sqlalchemy.orm import selectinload
from sqlmodel import select, text

from src.dependencies import get_current_tenant_id, get_db, get_optional_tenant_user
from src.orm.models.order import Customer, CustomerAddress, CustomerTimelineEvent, StoreCreditTransaction
from src.orm.schemas.customer import (
    CustomerAddressCreate,
    CustomerAddressResponse,
    CustomerAddressUpdate,
    CustomerCreate,
    CustomerDetailResponse,
    CustomerMetricsResponse,
    CustomerOrderResponse,
    CustomerResponse,
    CustomerUpdate,
    StoreCreditAddRequest,
    StoreCreditTransactionResponse,
    TimelineEventCreate,
    TimelineEventResponse,
)

router = APIRouter(tags=["customers"])

SORT_WHITELIST = {"name", "email", "total_spent", "total_orders", "created_at", "last_order_at"}


@router.get("/customers/")
async def list_customers(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    location: str | None = None,
    min_spent: int | None = Query(default=None, ge=0),
    max_spent: int | None = Query(default=None, ge=0),
    tag: str | None = None,
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
):
    stmt = select(Customer).where(Customer.tenant_id == tenant_id)
    count_stmt = select(sa_func.count()).select_from(Customer).where(Customer.tenant_id == tenant_id)

    if search:
        pattern = f"%{search}%"
        filter_clause = (
            Customer.email.ilike(pattern)
            | Customer.first_name.ilike(pattern)
            | Customer.last_name.ilike(pattern)
        )
        stmt = stmt.where(filter_clause)
        count_stmt = count_stmt.where(filter_clause)

    if status:
        stmt = stmt.where(Customer.email_subscription_status == status)
        count_stmt = count_stmt.where(Customer.email_subscription_status == status)

    if location:
        loc_pattern = f"%{location}%"
        from src.orm.models.order import CustomerAddress

        address_filter = CustomerAddress.city.ilike(loc_pattern) | CustomerAddress.country.ilike(loc_pattern)
        stmt = stmt.where(Customer.addresses.any(address_filter))
        count_stmt = count_stmt.where(Customer.addresses.any(address_filter))

    if min_spent is not None:
        stmt = stmt.where(Customer.total_spent >= min_spent)
        count_stmt = count_stmt.where(Customer.total_spent >= min_spent)

    if max_spent is not None:
        stmt = stmt.where(Customer.total_spent <= max_spent)
        count_stmt = count_stmt.where(Customer.total_spent <= max_spent)

    if tag:
        stmt = stmt.where(Customer.tags[tag].as_string() == "true")
        count_stmt = count_stmt.where(Customer.tags[tag].as_string() == "true")

    if sort_by in SORT_WHITELIST:
        sort_col = getattr(Customer, sort_by, Customer.created_at)
        stmt = stmt.order_by(sort_col.desc() if sort_order == "desc" else sort_col.asc())
    else:
        stmt = stmt.order_by(Customer.created_at.desc())

    stmt = stmt.offset((page - 1) * per_page).limit(per_page)

    customers = (await db.exec(stmt)).all()
    total = (await db.exec(count_stmt)).one()

    return {
        "data": [CustomerResponse.model_validate(c) for c in customers],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.post("/customers/", response_model=CustomerResponse, status_code=201)
async def create_customer(
    body: CustomerCreate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    if not body.email and not body.phone:
        raise HTTPException(status_code=422, detail="Either email or phone is required")

    customer = Customer(
        tenant_id=tenant_id,
        email=body.email,
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
        email_subscription_status=body.email_subscription_status or "subscribed",
        email_subscription_type=body.email_subscription_type or "digital",
        tags=body.tags or {},
        notes=body.notes,
        language=body.language,
        email_marketing_consent=body.email_marketing_consent,
        sms_marketing_consent=body.sms_marketing_consent,
        tax_exempt=body.tax_exempt,
        tax_exempt_reason=body.tax_exempt_reason if body.tax_exempt else None,
    )
    db.add(customer)
    await db.flush()

    has_address = any([body.address_line1, body.address_city, body.address_postal_code, body.address_country])
    if has_address:
        from src.orm.models.order import CustomerAddress

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
            phone=body.address_phone or None,
            is_default=True,
        )
        db.add(address)

    await db.flush()
    await db.refresh(customer)
    return customer


@router.get("/customers/{customer_id}", response_model=CustomerDetailResponse)
async def get_customer(
    customer_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = (
        select(Customer)
        .where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
        .options(selectinload(Customer.addresses), selectinload(Customer.orders))
    )
    customer = (await db.exec(stmt)).one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    aov = customer.total_spent // customer.total_orders if customer.total_orders > 0 else 0

    orders = [
        CustomerOrderResponse(
            id=o.id,
            order_number=o.order_number,
            total=int(o.total),
            status=o.status.value if hasattr(o.status, "value") else o.status,
            created_at=o.created_at,
        )
        for o in customer.orders
    ]

    addresses = [CustomerAddressResponse.model_validate(a) for a in customer.addresses]

    base = CustomerResponse.model_validate(customer)
    return CustomerDetailResponse(
        **base.model_dump(),
        average_order_value=aov,
        addresses=addresses,
        orders=orders,
    )


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: UUID,
    body: CustomerUpdate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    customer = (await db.exec(stmt)).one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(customer, key, value)

    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return customer


@router.delete("/customers/{customer_id}", status_code=204)
async def delete_customer(
    customer_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    customer = (await db.exec(stmt)).one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    await db.delete(customer)


@router.get("/customers/metrics", response_model=CustomerMetricsResponse)
async def get_customer_metrics(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(Customer).where(Customer.tenant_id == tenant_id)
    all_customers = (await db.exec(stmt)).all()

    total = len(all_customers)
    subscribed = sum(1 for c in all_customers if c.email_subscription_status == "subscribed")
    unsubscribed = sum(1 for c in all_customers if c.email_subscription_status == "unsubscribed")
    bounced = sum(1 for c in all_customers if c.email_subscription_status == "bounced")
    with_credit = sum(1 for c in all_customers if c.store_credit > 0)
    total_credit = sum(c.store_credit for c in all_customers)
    avg_spent = sum(c.total_spent for c in all_customers) // total if total > 0 else 0

    return CustomerMetricsResponse(
        total_customers=total,
        total_base=total,
        percentage=100.0,
        subscribed=subscribed,
        unsubscribed=unsubscribed,
        bounced=bounced,
        with_store_credit=with_credit,
        total_store_credit=total_credit,
        avg_spent=avg_spent,
    )


# ── Timeline ──────────────────────────────────────────────────────────


@router.get("/customers/{customer_id}/timeline", response_model=list[TimelineEventResponse])
async def get_customer_timeline(
    customer_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = (
        select(CustomerTimelineEvent)
        .where(
            CustomerTimelineEvent.customer_id == customer_id,
            Customer.tenant_id == tenant_id,
        )
        .join(Customer)
        .order_by(CustomerTimelineEvent.created_at.desc())
    )
    events = (await db.exec(stmt)).all()
    return [TimelineEventResponse.model_validate(e) for e in events]


@router.post("/customers/{customer_id}/timeline", response_model=TimelineEventResponse, status_code=201)
async def add_timeline_event(
    customer_id: UUID,
    body: TimelineEventCreate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    customer = (await db.exec(stmt)).one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    event = CustomerTimelineEvent(
        customer_id=customer_id,
        event_type=body.event_type,
        description=body.description,
        extra_data=body.extra_data,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


# ── Store Credit ──────────────────────────────────────────────────────


@router.get("/customers/{customer_id}/credit")
async def get_customer_credit(
    customer_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    customer = (await db.exec(stmt)).one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    tx_stmt = (
        select(StoreCreditTransaction)
        .where(StoreCreditTransaction.customer_id == customer_id)
        .order_by(StoreCreditTransaction.created_at.desc())
    )
    transactions = (await db.exec(tx_stmt)).all()

    return {
        "balance": customer.store_credit,
        "transactions": [StoreCreditTransactionResponse.model_validate(t) for t in transactions],
    }


@router.post("/customers/{customer_id}/credit", response_model=StoreCreditTransactionResponse, status_code=201)
async def add_customer_credit(
    customer_id: UUID,
    body: StoreCreditAddRequest,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = (
        select(Customer)
        .where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
        .with_for_update()
    )
    customer = (await db.exec(stmt)).one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    new_balance = customer.store_credit + body.amount
    if new_balance < 0:
        raise HTTPException(status_code=422, detail="Insufficient store credit")

    customer.store_credit = new_balance
    db.add(customer)

    tx = StoreCreditTransaction(
        customer_id=customer_id,
        amount=body.amount,
        balance_after=new_balance,
        reason=body.reason,
    )
    db.add(tx)

    event = CustomerTimelineEvent(
        customer_id=customer_id,
        event_type="credit_added" if body.amount > 0 else "credit_deducted",
        description=f"{'Added' if body.amount > 0 else 'Deducted'} \u00A3 {abs(body.amount) / 100:.2f}: {body.reason}",
    )
    db.add(event)

    await db.flush()
    await db.refresh(tx)
    return tx


# ── CSV Export ────────────────────────────────────────────────────────


@router.get("/customers/export")
async def export_customers_csv(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    actor=Depends(get_optional_tenant_user),
    search: str | None = None,
    status: str | None = None,
    location: str | None = None,
    min_spent: int | None = Query(default=None, ge=0),
    max_spent: int | None = Query(default=None, ge=0),
    tag: str | None = None,
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
):
    """Export filtered customers as CSV download."""

    from src.services.audit_service import record_audit

    if actor:
        record_audit(
            tenant_id=tenant_id,
            actor_user_id=actor.id,
            actor_email=actor.email,
            action="customers.export",
            resource_type="customer",
            details={"search": search, "status": status, "location": location},
        )
    stmt = select(Customer).where(Customer.tenant_id == tenant_id)

    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            Customer.email.ilike(pattern)
            | Customer.first_name.ilike(pattern)
            | Customer.last_name.ilike(pattern)
        )
    if status:
        stmt = stmt.where(Customer.email_subscription_status == status)
    if location:
        loc_pattern = f"%{location}%"
        from src.orm.models.order import CustomerAddress
        stmt = stmt.where(Customer.addresses.any(CustomerAddress.city.ilike(loc_pattern) | CustomerAddress.country.ilike(loc_pattern)))
    if min_spent is not None:
        stmt = stmt.where(Customer.total_spent >= min_spent)
    if max_spent is not None:
        stmt = stmt.where(Customer.total_spent <= max_spent)
    if tag:
        stmt = stmt.where(Customer.tags[tag].as_string() == "true")
    if sort_by in {"name", "email", "total_spent", "total_orders", "created_at", "last_order_at"}:
        col = getattr(Customer, sort_by, Customer.created_at)
        stmt = stmt.order_by(col.desc() if sort_order == "desc" else col.asc())
    else:
        stmt = stmt.order_by(Customer.created_at.desc())

    customers = (await db.exec(stmt)).all()

    def generate():
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["email", "first_name", "last_name", "phone", "subscription_status", "store_credit_pounds", "tags"])
        for c in customers:
            credit_pounds = f"{c.store_credit / 100:.2f}"
            tags_str = ",".join(k for k, v in (c.tags or {}).items() if v)
            writer.writerow([c.email, c.first_name or "", c.last_name or "", c.phone or "", c.email_subscription_status, credit_pounds, tags_str])
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    filename = f"customers-export-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.csv"
    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )


# ── CSV Import ────────────────────────────────────────────────────────


@router.post("/customers/import")
async def import_customers_csv(
    file: UploadFile = File(...),
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    """Import customers from uploaded CSV file. Upserts on (tenant_id, email)."""
    from src.services.import_service import ImportResult, parse_csv, validate_rows

    content = (await file.read()).decode("utf-8-sig")
    rows = parse_csv(content)
    result = ImportResult()

    validated = validate_rows(rows, result)
    result.total = len(rows)

    for row_data in validated:
        try:
            await db.execute(
                text("""
                    INSERT INTO customers (id, tenant_id, email, first_name, last_name, phone, email_subscription_status, email_subscription_type, tags, store_credit, is_verified, total_orders, total_spent, refunded_total, language, email_marketing_consent, sms_marketing_consent, tax_exempt, created_at, updated_at)
                    VALUES (:id, :tid, :email, :first_name, :last_name, :phone, :sub_status, 'digital', CAST(:tags AS jsonb), :store_credit, false, 0, 0, 0, 'en', false, false, false, NOW(), NOW())
                    ON CONFLICT (tenant_id, email) DO UPDATE SET
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        phone = EXCLUDED.phone,
                        email_subscription_status = EXCLUDED.email_subscription_status,
                        tags = EXCLUDED.tags,
                        store_credit = EXCLUDED.store_credit,
                        updated_at = NOW()
                """),
                {
                    "id": uuid4(),
                    "tid": tenant_id,
                    "email": row_data["email"],
                    "first_name": row_data["first_name"],
                    "last_name": row_data["last_name"],
                    "phone": row_data["phone"],
                    "sub_status": row_data["email_subscription_status"],
                    "tags": row_data["tags"],
                    "store_credit": row_data["store_credit"],
                },
            )
            result.created += 1
        except Exception as e:
            result.add_error(0, "db", row_data["email"], str(e))

    await db.flush()

    return {
        "total": result.total,
        "imported": result.created,
        "errors": result.errors,
    }


@router.post("/customers/import/resolve")
async def resolve_csv_import_errors(
    body: dict,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    """Apply corrected rows from CSV import error resolution.

    Payload: { corrections: [{ row: number, ...fields }] }
    Each correction overwrites the original row's fields via upsert.
    """
    corrections = body.get("corrections", [])
    if not corrections:
        raise HTTPException(status_code=400, detail="No corrections provided")

    fixed = 0
    errors = 0

    for corr in corrections:
        try:
            email = corr.get("email")
            if not email:
                errors += 1
                continue

            update_fields = {}
            for field in ("first_name", "last_name", "phone", "email_subscription_status"):
                if field in corr:
                    update_fields[field] = corr[field]
            if "store_credit" in corr:
                try:
                    update_fields["store_credit"] = int(float(corr["store_credit"]))
                except (ValueError, TypeError):
                    pass

            await db.execute(
                text("""
                    INSERT INTO customers (id, tenant_id, email, first_name, last_name, phone, email_subscription_status, email_subscription_type, tags, store_credit, is_verified, total_orders, total_spent, refunded_total, language, email_marketing_consent, sms_marketing_consent, tax_exempt, created_at, updated_at)
                    VALUES (:id, :tid, :email, :fn, :ln, :phone, :sub_status, 'digital', '{}'::jsonb, :credit, false, 0, 0, 0, 'en', false, false, false, NOW(), NOW())
                    ON CONFLICT (tenant_id, email) DO UPDATE SET
                        first_name = CASE WHEN :fn <> '' THEN EXCLUDED.first_name ELSE customers.first_name END,
                        last_name = CASE WHEN :ln <> '' THEN EXCLUDED.last_name ELSE customers.last_name END,
                        phone = CASE WHEN :phone <> '' THEN EXCLUDED.phone ELSE customers.phone END,
                        updated_at = NOW()
                """),
                {
                    "id": uuid4(),
                    "tid": tenant_id,
                    "email": email,
                    "fn": update_fields.get("first_name", ""),
                    "ln": update_fields.get("last_name", ""),
                    "phone": update_fields.get("phone", ""),
                    "sub_status": update_fields.get("email_subscription_status", "subscribed"),
                    "credit": update_fields.get("store_credit", 0),
                },
            )
            fixed += 1
        except Exception:
            errors += 1

    await db.flush()

    return {"fixed": fixed, "errors": errors}


# ── Address CRUD ─────────────────────────────────────────────────────


@router.post("/customers/{customer_id}/addresses", response_model=CustomerAddressResponse, status_code=201)
async def create_customer_address(
    customer_id: UUID,
    body: CustomerAddressCreate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    customer = (await db.exec(stmt)).one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    address = CustomerAddress(
        customer_id=customer_id,
        tenant_id=tenant_id,
        **body.model_dump(exclude_unset=True),
    )
    db.add(address)
    await db.flush()
    await db.refresh(address)
    return address


@router.put("/customers/{customer_id}/addresses/{address_id}", response_model=CustomerAddressResponse)
async def update_customer_address(
    customer_id: UUID,
    address_id: UUID,
    body: CustomerAddressUpdate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(CustomerAddress).where(
        CustomerAddress.id == address_id,
        CustomerAddress.customer_id == customer_id,
        CustomerAddress.tenant_id == tenant_id,
    )
    address = (await db.exec(stmt)).one_or_none()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(address, key, value)

    db.add(address)
    await db.flush()
    await db.refresh(address)
    return address


@router.delete("/customers/{customer_id}/addresses/{address_id}", status_code=204)
async def delete_customer_address(
    customer_id: UUID,
    address_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(CustomerAddress).where(
        CustomerAddress.id == address_id,
        CustomerAddress.customer_id == customer_id,
        CustomerAddress.tenant_id == tenant_id,
    )
    address = (await db.exec(stmt)).one_or_none()
    if not address:
        raise HTTPException(status_code=404, detail="Address not found")

    await db.delete(address)
