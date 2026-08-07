"""Analytics endpoints — aggregate queries over existing order data."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlmodel import select, text as sql_text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.cart import Cart
from src.orm.models.order import Customer, Order, OrderItem
from src.orm.models.product import Product, Variant
from src.orm.schemas.analytics import (
    CartAbandonmentPoint,
    CartReportRow,
    CategoryBreakdownResponse,
    CustomerLTVRow,
    CustomReportRequest,
    CustomReportResponse,
    LiveViewResponse,
    MonthlyRetentionPoint,
    ProductReportRow,
    SalesReportRow,
    TopProductResponse,
)

router = APIRouter(tags=["analytics"])

ALLOWED_DIMENSIONS = {
    "category": "c.name",
    "order_status": "o.status",
    "customer_email": "cust.email",
    "month": "to_char(DATE_TRUNC('month', o.created_at), 'YYYY-MM')",
    "day": "to_char(o.created_at, 'YYYY-MM-DD')",
}

ALLOWED_METRICS = {
    "total_revenue": "COALESCE(SUM(oi.total_price), 0)",
    "order_count": "COUNT(DISTINCT o.id)",
    "avg_order_value": "COALESCE(SUM(oi.total_price) / NULLIF(COUNT(DISTINCT o.id), 0), 0)",
    "units_sold": "COALESCE(SUM(oi.quantity), 0)",
    "customer_count": "COUNT(DISTINCT o.customer_id)",
    "refund_total": "COALESCE(SUM(CASE WHEN LOWER(o.status::text) = 'refunded' THEN oi.total_price ELSE 0 END), 0)",
}


async def _stream_csv(db: AsyncSession, stmt, columns: list[str], filename: str):
    """Yield CSV rows from a SQL statement."""
    import csv
    from io import StringIO

    from fastapi.responses import StreamingResponse

    result = await db.exec(stmt)
    rows = result.all()

    async def generate():
        buffer = StringIO()
        writer = csv.writer(buffer)
        writer.writerow(columns)
        for r in rows:
            writer.writerow([getattr(r, c, "") for c in columns])
            yield buffer.getvalue()
            buffer.seek(0)
            buffer.truncate(0)

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/top-products", response_model=list[TopProductResponse])
async def top_products(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    limit: int = Query(default=5, ge=1, le=50),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    sort_by: str = Query(default="revenue"),
):
    """Top products by revenue or units sold."""
    stmt = (
        select(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            func.min(Variant.sku).label("primary_sku"),
            func.sum(OrderItem.quantity).label("units_sold"),
            func.sum(OrderItem.total_price).label("total_revenue"),
        )
        .join(Variant, OrderItem.variant_id == Variant.id)
        .join(Product, Variant.product_id == Product.id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.tenant_id == tenant_id)
        .where(Order.status.notin_(["cancelled", "refunded"]))
    )

    if start_date:
        stmt = stmt.where(Order.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        stmt = stmt.where(Order.created_at <= datetime.fromisoformat(end_date))

    stmt = stmt.group_by(Product.id, Product.name)

    if sort_by == "units":
        stmt = stmt.order_by(func.sum(OrderItem.quantity).desc())
    else:
        stmt = stmt.order_by(func.sum(OrderItem.total_price).desc())

    stmt = stmt.limit(limit)
    result = await db.exec(stmt)
    return [
        TopProductResponse(
            product_id=r.product_id,
            product_name=r.product_name,
            primary_sku=r.primary_sku,
            units_sold=int(r.units_sold),
            total_revenue=int(r.total_revenue),
        )
        for r in result
    ]


@router.get("/category-breakdown", response_model=list[CategoryBreakdownResponse])
async def category_breakdown(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Revenue and units sold by product category."""
    from sqlalchemy import String

    from src.orm.models.category import Category

    stmt = (
        select(
            func.coalesce(Category.id.cast(String), "uncategorized").label("category_id"),
            func.coalesce(Category.name, "Uncategorized").label("category_name"),
            func.sum(OrderItem.quantity).label("units_sold"),
            func.sum(OrderItem.total_price).label("total_revenue"),
        )
        .join(Variant, OrderItem.variant_id == Variant.id)
        .join(Product, Variant.product_id == Product.id)
        .outerjoin(Category, Product.category_id == Category.id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.tenant_id == tenant_id)
        .where(Order.status.notin_(["cancelled", "refunded"]))
    )

    if start_date:
        stmt = stmt.where(Order.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        stmt = stmt.where(Order.created_at <= datetime.fromisoformat(end_date))

    stmt = stmt.group_by(Category.id, Category.name)
    stmt = stmt.order_by(func.sum(OrderItem.total_price).desc())
    result = await db.exec(stmt)
    rows = list(result)

    total_revenue = sum(int(r.total_revenue) for r in rows) if rows else 0

    return [
        CategoryBreakdownResponse(
            category_id=str(r.category_id),
            category_name=str(r.category_name),
            units_sold=int(r.units_sold),
            total_revenue=int(r.total_revenue),
            percentage_of_total=round(int(r.total_revenue) / total_revenue * 100, 1) if total_revenue else 0.0,
        )
        for r in rows
    ]


@router.get("/customer-retention", response_model=list[MonthlyRetentionPoint])
async def customer_retention(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Monthly new vs returning customer revenue."""
    filters = "AND o.created_at >= :start" if start_date else ""
    filters += " AND o.created_at <= :end" if end_date else ""
    params: dict = {"tid": tenant_id}
    if start_date:
        params["start"] = datetime.fromisoformat(start_date)
    if end_date:
        params["end"] = datetime.fromisoformat(end_date)

    result = await db.execute(sql_text(f"""
        WITH customer_orders AS (
            SELECT c.email, o.created_at, o.total
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN customers c ON c.id = o.customer_id
            WHERE o.tenant_id = :tid AND LOWER(o.status::text) NOT IN ('cancelled', 'refunded')
            {filters}
        ),
        first_purchase AS (
            SELECT email, MIN(created_at) AS first_date
            FROM customer_orders GROUP BY email
        )
        SELECT
            to_char(DATE_TRUNC('month', co.created_at), 'YYYY-MM') AS month,
            COUNT(DISTINCT CASE WHEN DATE_TRUNC('month', co.created_at) = DATE_TRUNC('month', fp.first_date) THEN co.email END) AS new_customers,
            COUNT(DISTINCT CASE WHEN DATE_TRUNC('month', co.created_at) > DATE_TRUNC('month', fp.first_date) THEN co.email END) AS returning_customers,
            COALESCE(SUM(CASE WHEN DATE_TRUNC('month', co.created_at) = DATE_TRUNC('month', fp.first_date) THEN co.total ELSE 0 END), 0) AS new_revenue,
            COALESCE(SUM(CASE WHEN DATE_TRUNC('month', co.created_at) > DATE_TRUNC('month', fp.first_date) THEN co.total ELSE 0 END), 0) AS returning_revenue
        FROM customer_orders co
        JOIN first_purchase fp ON co.email = fp.email
        GROUP BY month ORDER BY month
    """), params)
    rows = result.all()
    return [
        MonthlyRetentionPoint(
            month=r[0], new_customers=int(r[1]), returning_customers=int(r[2]),
            new_revenue=int(r[3]), returning_revenue=int(r[4]),
        ) for r in rows
    ]


@router.get("/cart-abandonment", response_model=list[CartAbandonmentPoint])
async def cart_abandonment(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Monthly abandoned vs completed cart counts."""
    filters = "AND created_at >= :start" if start_date else ""
    filters += " AND created_at <= :end" if end_date else ""
    params: dict = {"tid": tenant_id}
    if start_date:
        params["start"] = datetime.fromisoformat(start_date)
    if end_date:
        params["end"] = datetime.fromisoformat(end_date)

    result = await db.execute(sql_text(f"""
        SELECT
            to_char(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
            COUNT(*) FILTER (WHERE LOWER(status::text) = 'abandoned') AS abandoned_carts,
            COUNT(*) FILTER (WHERE LOWER(status::text) = 'completed') AS completed_carts
        FROM carts
        WHERE tenant_id = :tid {filters}
        GROUP BY month ORDER BY month
    """), params)
    rows = result.all()
    return [
        CartAbandonmentPoint(
            month=r[0], abandoned_carts=int(r[1]), completed_carts=int(r[2]),
        ) for r in rows
    ]


@router.get("/reports/sales")
async def sales_report(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    period: str = Query(default="daily"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    format: Optional[str] = Query(None),
):
    """Aggregated sales report by period."""
    trunc = "day" if period == "daily" else "week" if period == "weekly" else "month"
    filters = "AND o.created_at >= :start" if start_date else ""
    filters += " AND o.created_at <= :end" if end_date else ""
    params: dict = {"tid": tenant_id}
    if start_date:
        params["start"] = datetime.fromisoformat(start_date)
    if end_date:
        params["end"] = datetime.fromisoformat(end_date)

    stmt = sql_text(f"""
        SELECT
            to_char(DATE_TRUNC('{trunc}', o.created_at), 'YYYY-MM-DD') AS period,
            COALESCE(SUM(oi.total_price), 0) AS gross_sales,
            0 AS discounts,
            COALESCE(SUM(oi.total_price), 0) AS net_sales,
            0 AS tax,
            0 AS shipping,
            COALESCE(SUM(CASE WHEN LOWER(o.status::text) = 'refunded' THEN oi.total_price ELSE 0 END), 0) AS refunds,
            COUNT(DISTINCT o.id) AS order_count
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.tenant_id = :tid AND LOWER(o.status::text) NOT IN ('cancelled')
        {filters}
        GROUP BY DATE_TRUNC('{trunc}', o.created_at)
        ORDER BY period
    """)
    if format == "csv":
        return await _stream_csv(db, stmt, params | {"tid": tenant_id}, columns=["period", "gross_sales", "discounts", "net_sales", "tax", "shipping", "refunds", "order_count"], filename="sales-report.csv")

    result = await db.execute(stmt, params)
    return [SalesReportRow(period=r[0], gross_sales=int(r[1]), discounts=int(r[2]), net_sales=int(r[3]), tax=int(r[4]), shipping=int(r[5]), refunds=int(r[6]), order_count=int(r[7])) for r in result.all()]


@router.get("/reports/products")
async def products_report(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    format: Optional[str] = Query(None),
):
    """Product performance from order_items."""
    filters = "AND o.created_at >= :start" if start_date else ""
    filters += " AND o.created_at <= :end" if end_date else ""
    params: dict = {"tid": tenant_id}
    if start_date:
        params["start"] = datetime.fromisoformat(start_date)
    if end_date:
        params["end"] = datetime.fromisoformat(end_date)

    stmt = sql_text(f"""
        SELECT
            p.name AS product_name,
            MIN(v.sku) AS sku,
            c.name AS category,
            SUM(oi.quantity) AS units_sold,
            SUM(oi.total_price) AS total_revenue,
            COALESCE(SUM(oi.total_price) / NULLIF(SUM(oi.quantity), 0), 0) AS avg_price,
            COUNT(DISTINCT o.id) AS times_ordered
        FROM order_items oi
        JOIN variants v ON v.id = oi.variant_id
        JOIN products p ON p.id = v.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        JOIN orders o ON o.id = oi.order_id
        WHERE o.tenant_id = :tid AND LOWER(o.status::text) NOT IN ('cancelled', 'refunded')
        {filters}
        GROUP BY p.id, p.name, c.name
        ORDER BY total_revenue DESC
    """)
    if format == "csv":
        return await _stream_csv(db, stmt, params | {"tid": tenant_id}, columns=["product_name", "sku", "category", "units_sold", "total_revenue", "avg_price", "times_ordered"], filename="products-report.csv")

    result = await db.execute(stmt, params)
    return [ProductReportRow(product_name=r[0], sku=r[1], category=r[2], units_sold=int(r[3]), total_revenue=int(r[4]), avg_price=float(r[5]), times_ordered=int(r[6])) for r in result.all()]


@router.get("/reports/customers")
async def customers_report(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    format: Optional[str] = Query(None),
):
    """Customer LTV report."""
    filters = "AND o.created_at >= :start" if start_date else ""
    filters += " AND o.created_at <= :end" if end_date else ""
    params: dict = {"tid": tenant_id}
    if start_date:
        params["start"] = datetime.fromisoformat(start_date)
    if end_date:
        params["end"] = datetime.fromisoformat(end_date)

    stmt = sql_text(f"""
        SELECT
            c.email,
            MIN(o.created_at::text) AS first_order,
            MAX(o.created_at::text) AS last_order,
            COUNT(DISTINCT o.id) AS order_count,
            SUM(oi.total_price) AS total_spent,
            COALESCE(SUM(oi.total_price) / NULLIF(COUNT(DISTINCT o.id), 0), 0) AS avg_order_value
        FROM customers c
        JOIN orders o ON o.customer_id = c.id
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.tenant_id = :tid AND LOWER(o.status::text) NOT IN ('cancelled', 'refunded')
        {filters}
        GROUP BY c.email
        ORDER BY total_spent DESC
    """)
    if format == "csv":
        return await _stream_csv(db, stmt, params | {"tid": tenant_id}, columns=["email", "first_order", "last_order", "order_count", "total_spent", "avg_order_value"], filename="customers-report.csv")

    result = await db.execute(stmt, params)
    return [CustomerLTVRow(email=r[0], first_order=r[1], last_order=r[2], order_count=int(r[3]), total_spent=int(r[4]), avg_order_value=float(r[5])) for r in result.all()]


@router.get("/reports/carts")
async def carts_report(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    period: str = Query(default="daily"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    format: Optional[str] = Query(None),
):
    """Cart conversion report by period."""
    trunc = "day" if period == "daily" else "week" if period == "weekly" else "month"
    filters = "AND created_at >= :start" if start_date else ""
    filters += " AND created_at <= :end" if end_date else ""
    params: dict = {"tid": tenant_id}
    if start_date:
        params["start"] = datetime.fromisoformat(start_date)
    if end_date:
        params["end"] = datetime.fromisoformat(end_date)

    stmt = sql_text(f"""
        SELECT
            to_char(DATE_TRUNC('{trunc}', created_at), 'YYYY-MM-DD') AS period,
            COUNT(*) FILTER (WHERE LOWER(status::text) = 'active') AS active_carts,
            COUNT(*) FILTER (WHERE LOWER(status::text) = 'abandoned') AS abandoned_carts,
            COUNT(*) FILTER (WHERE LOWER(status::text) = 'completed') AS completed_carts,
            COALESCE(ROUND(
                COUNT(*) FILTER (WHERE LOWER(status::text) = 'completed')::numeric /
                NULLIF(COUNT(*) FILTER (WHERE LOWER(status::text) IN ('abandoned', 'completed')), 0) * 100, 2
            ), 0.00) AS conversion_rate
        FROM carts
        WHERE tenant_id = :tid {filters}
        GROUP BY DATE_TRUNC('{trunc}', created_at)
        ORDER BY period
    """)
    if format == "csv":
        return await _stream_csv(db, stmt, params | {"tid": tenant_id}, columns=["period", "active_carts", "abandoned_carts", "completed_carts", "conversion_rate"], filename="carts-report.csv")

    result = await db.execute(stmt, params)
    return [CartReportRow(period=r[0], active_carts=int(r[1]), abandoned_carts=int(r[2]), completed_carts=int(r[3]), conversion_rate=float(r[4])) for r in result.all()]


@router.get("/live-view", response_model=LiveViewResponse)
async def live_view(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    """Active carts, today's revenue, and recent activity."""
    now = datetime.now(timezone.utc)

    active = await db.execute(sql_text("""
        SELECT COUNT(*) FROM carts
        WHERE tenant_id = :tid AND LOWER(status::text) = 'active'
        AND updated_at >= :cutoff
    """), {"tid": tenant_id, "cutoff": now})

    today_rev = await db.execute(sql_text("""
        SELECT COALESCE(SUM(oi.total_price), 0)
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.tenant_id = :tid AND LOWER(o.status::text) NOT IN ('cancelled', 'refunded')
        AND o.created_at >= :today
    """), {"tid": tenant_id, "today": now.replace(hour=0, minute=0, second=0, microsecond=0)})

    today_orders = await db.execute(sql_text("""
        SELECT COUNT(*) FROM orders
        WHERE tenant_id = :tid AND LOWER(status::text) NOT IN ('cancelled', 'refunded')
        AND created_at >= :today
    """), {"tid": tenant_id, "today": now.replace(hour=0, minute=0, second=0, microsecond=0)})

    activity = await db.execute(sql_text("""
        SELECT 'order' AS type, id, created_at::text AS ts, 'Order' AS label FROM orders
        WHERE tenant_id = :tid AND created_at >= :cutoff
        UNION ALL
        SELECT 'cart' AS type, id, updated_at::text AS ts, LOWER(status::text) AS label FROM carts
        WHERE tenant_id = :tid AND updated_at >= :cutoff
        ORDER BY ts DESC LIMIT 20
    """), {"tid": tenant_id, "cutoff": now})

    return LiveViewResponse(
        active_carts=active.scalar() or 0,
        today_revenue=today_rev.scalar() or 0,
        today_orders=today_orders.scalar() or 0,
        recent_activity=[dict(r._mapping) for r in activity.all()],
    )


@router.post("/custom-reports", response_model=CustomReportResponse)
async def custom_report(
    body: CustomReportRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    """Dynamic custom report with safe whitelist-based SQL."""
    selected_dims = []
    for d in body.dimensions:
        if d not in ALLOWED_DIMENSIONS:
            raise HTTPException(status_code=400, detail=f"Invalid dimension: {d}")
        selected_dims.append(f"{ALLOWED_DIMENSIONS[d]} AS {d}")

    selected_metrics = []
    for m in body.metrics:
        if m not in ALLOWED_METRICS:
            raise HTTPException(status_code=400, detail=f"Invalid metric: {m}")
        selected_metrics.append(f"{ALLOWED_METRICS[m]} AS {m}")

    select_parts = selected_dims + selected_metrics
    select_clause = ", ".join(select_parts) if select_parts else "*"

    group_parts = []
    for g in body.group_by:
        if g not in ALLOWED_DIMENSIONS:
            raise HTTPException(status_code=400, detail=f"Invalid group_by: {g}")
        group_parts.append(ALLOWED_DIMENSIONS[g])
    group_clause = ", ".join(group_parts) if group_parts else ""

    order_clause = ""
    if body.order_by:
        col = body.order_by.get("column", "")
        if col not in ALLOWED_METRICS and col not in ALLOWED_DIMENSIONS:
            raise HTTPException(status_code=400, detail=f"Invalid order_by column: {col}")
        dir = "DESC" if body.order_by.get("direction", "").lower() == "desc" else "ASC"
        order_clause = f"ORDER BY {ALLOWED_METRICS.get(col) or ALLOWED_DIMENSIONS.get(col) or col} {dir}"

    where_clauses = ["o.tenant_id = :tid", "LOWER(o.status::text) NOT IN ('cancelled', 'refunded')"]
    filter_params: dict = {"tid": tenant_id}

    if "start_date" in body.filters:
        where_clauses.append("o.created_at >= :start_date")
        filter_params["start_date"] = datetime.fromisoformat(body.filters["start_date"])
    if "end_date" in body.filters:
        where_clauses.append("o.created_at <= :end_date")
        filter_params["end_date"] = datetime.fromisoformat(body.filters["end_date"])
    if "min_total" in body.filters:
        where_clauses.append("oi.total_price >= :min_total")
        filter_params["min_total"] = body.filters["min_total"]

    where_clause = " AND ".join(where_clauses)

    q = f"""
        SELECT {select_clause}
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        LEFT JOIN variants v ON v.id = oi.variant_id
        LEFT JOIN products p ON p.id = v.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN customers cust ON cust.id = o.customer_id
        WHERE {where_clause}
    """
    if group_clause:
        q += f" GROUP BY {group_clause}"
    if order_clause:
        q += f" {order_clause}"
    q += f" LIMIT {body.limit}"

    result = await db.execute(sql_text(q), filter_params)
    rows = result.all()
    if not rows:
        return CustomReportResponse(columns=body.dimensions + body.metrics, rows=[])
    columns = list(rows[0]._mapping.keys())
    return CustomReportResponse(
        columns=columns,
        rows=[dict(r._mapping) for r in rows],
    )
