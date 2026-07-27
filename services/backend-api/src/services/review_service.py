"""Review service — creation, moderation, rating recomputation."""

from uuid import UUID

from sqlalchemy import func, select, text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.order import Order, OrderItem
from src.orm.models.product import Product
from src.orm.models.review import ProductReview


async def create_review(
    db: AsyncSession,
    tenant_id: UUID,
    product_id: UUID,
    rating: int,
    title: str,
    body: str,
    reviewer_name: str,
    customer_email: str | None = None,
) -> ProductReview:
    """Create a review. Auto-verifies buyer if email matches an order for this product."""
    is_verified = False
    if customer_email:
        result = await db.execute(
            select(OrderItem.id)
            .join(Order, OrderItem.order_id == Order.id)
            .where(
                Order.tenant_id == tenant_id,
                Order.customer_email == customer_email,
                OrderItem.product_id == product_id,
                Order.status.in_(["paid", "processing", "shipped", "delivered"]),
            )
            .limit(1)
        )
        is_verified = result.first() is not None

    review = ProductReview(
        tenant_id=tenant_id,
        product_id=product_id,
        rating=rating,
        title=title,
        body=body,
        reviewer_name=reviewer_name,
        is_verified_buyer=is_verified,
    )
    db.add(review)
    await db.flush()
    return review


async def approve_review(db: AsyncSession, review_id: UUID, tenant_id: UUID) -> ProductReview | None:
    review = (
        await db.exec(
            select(ProductReview).where(
                ProductReview.id == review_id,
                ProductReview.tenant_id == tenant_id,
            )
        )
    ).first()
    if not review:
        return None
    review.status = "APPROVED"
    db.add(review)
    await db.flush()
    await recompute_product_rating(db, review.product_id)
    return review


async def reject_review(db: AsyncSession, review_id: UUID, tenant_id: UUID) -> ProductReview | None:
    review = (
        await db.exec(
            select(ProductReview).where(
                ProductReview.id == review_id,
                ProductReview.tenant_id == tenant_id,
            )
        )
    ).first()
    if not review:
        return None
    review.status = "REJECTED"
    db.add(review)
    return review


async def recompute_product_rating(db: AsyncSession, product_id: UUID) -> None:
    """Recalculate avg_rating and review_count on the Product model."""
    await db.execute(
        text("""
            UPDATE products
            SET
                avg_rating = COALESCE((SELECT ROUND(AVG(rating) * 100) FROM product_reviews WHERE product_id = :pid AND status = 'APPROVED'), 0),
                review_count = COALESCE((SELECT COUNT(*) FROM product_reviews WHERE product_id = :pid AND status = 'APPROVED'), 0)
            WHERE id = :pid
        """),
        {"pid": product_id},
    )


async def increment_helpful(db: AsyncSession, review_id: UUID, tenant_id: UUID) -> bool:
    review = (
        await db.exec(
            select(ProductReview).where(
                ProductReview.id == review_id,
                ProductReview.tenant_id == tenant_id,
            )
        )
    ).first()
    if not review:
        return False
    review.helpful_count += 1
    db.add(review)
    await db.flush()
    return True
