"""Stripe adapter — abstracts Checkout Sessions vs PaymentIntent behind a common interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID, uuid4

from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.config import settings
from src.orm.models.order import Order, OrderItem as OrderItemModel, OrderStatus, PaymentStatus
from src.orm.models.product import Variant


@dataclass
class CheckoutItem:
    variant_id: UUID
    quantity: int


@dataclass
class CheckoutResult:
    session_id: str | None = None
    session_url: str | None = None
    client_secret: str | None = None


class StripeAdapter(ABC):
    """Interface for Stripe payment flows — two implementations live side by side."""

    @abstractmethod
    async def create_checkout(
        self,
        tenant_id: UUID,
        tenant_slug: str,
        customer_email: str,
        items: list[CheckoutItem],
        success_url: str,
        cancel_url: str,
        db: AsyncSession,
    ) -> CheckoutResult:
        ...

    @abstractmethod
    async def handle_event(self, payload: bytes, sig_header: str, db: AsyncSession) -> str | None:
        """Process a Stripe webhook event. Returns order_id if finalized."""
        ...


class CheckoutSessionAdapter(StripeAdapter):
    """Uses Stripe Checkout Sessions — hosted payment page, redirect flow."""

    async def create_checkout(
        self,
        tenant_id: UUID,
        tenant_slug: str,
        customer_email: str,
        items: list[CheckoutItem],
        success_url: str,
        cancel_url: str,
        db: AsyncSession,
    ) -> CheckoutResult:
        from fastapi import HTTPException
        import stripe

        stripe.api_key = settings.stripe_secret_key

        line_items = []
        total = 0
        resolved_variants: dict[UUID, Variant] = {}

        # 1. Fetch & validate all variants with eager-loaded products
        for ci in items:
            stmt = select(Variant).where(Variant.id == ci.variant_id).options(
                selectinload(Variant.product)
            )
            variant = (await db.exec(stmt)).one_or_none()
            if not variant or not variant.is_active:
                raise HTTPException(status_code=400, detail=f"Variant {ci.variant_id} not found")
            if variant.inventory_quantity < ci.quantity:
                raise HTTPException(
                    status_code=409,
                    detail=f"Insufficient stock for {variant.sku}",
                )

            resolved_variants[ci.variant_id] = variant
            product_name = variant.product.name if variant.product else "Product"
            total += variant.price * ci.quantity

            line_items.append({
                "price_data": {
                    "currency": "gbp",
                    "product_data": {"name": product_name},
                    "unit_amount": variant.price,
                },
                "quantity": ci.quantity,
            })

        # 2. Scaffold order
        order = Order(
            tenant_id=tenant_id,
            customer_email=customer_email,
            order_number=f"SF-{uuid4().hex[:12].upper()}",
            status=OrderStatus.PENDING_PAYMENT,
            payment_status=PaymentStatus.PENDING,
            total=total,
            currency="GBP",
            base_currency="GBP",
            inventory_deducted=False,
        )
        db.add(order)
        await db.flush()

        # 3. Create order items from in-memory cache (no second query)
        for ci in items:
            variant = resolved_variants[ci.variant_id]
            oi = OrderItemModel(
                order_id=order.id,
                tenant_id=tenant_id,
                variant_id=ci.variant_id,
                product_id=variant.product_id,
                product_name=variant.product.name if variant.product else "Product",
                sku=variant.sku,
                quantity=ci.quantity,
                unit_price=variant.price,
                total_price=variant.price * ci.quantity,
            )
            db.add(oi)

        await db.flush()

        # 4. Create Stripe session with order_id in metadata (not cart_items)
        session = stripe.checkout.Session.create(
            line_items=line_items,
            mode="payment",
            customer_email=customer_email,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "tenant_id": str(tenant_id),
                "order_id": str(order.id),
            },
        )

        # 5. Link session ID back to order & single commit
        order.payment_intent_id = session.id
        db.add(order)
        await db.commit()

        return CheckoutResult(session_id=session.id, session_url=session.url)

    async def handle_event(self, payload: bytes, sig_header: str, db: AsyncSession) -> str | None:
        import stripe

        from src.services.order_lifecycle import OrderLifecycleService

        stripe.api_key = settings.stripe_secret_key
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
        except (ValueError, stripe.error.SignatureVerificationError):
            return None

        if event["type"] == "checkout.session.completed":
            session = event["data"]["object"]
            order_id = session["metadata"].get("order_id")
            if not order_id:
                return None

            svc = OrderLifecycleService(db)
            order = await svc.finalize_successful_order(session["id"])
            if order:
                await db.commit()
                return str(order.id)

        return None


class PaymentIntentAdapter(StripeAdapter):
    """Existing flow — embedded PaymentElement with client_secret."""

    async def create_checkout(
        self,
        tenant_id: UUID,
        tenant_slug: str,
        customer_email: str,
        items: list[CheckoutItem],
        success_url: str,
        cancel_url: str,
        db: AsyncSession,
    ) -> CheckoutResult:
        # Delegate to existing /checkout/intent logic
        return CheckoutResult(client_secret="stub")

    async def handle_event(self, payload: bytes, sig_header: str, db: AsyncSession) -> str | None:
        import stripe

        from src.services.order_lifecycle import OrderLifecycleService

        stripe.api_key = settings.stripe_secret_key
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
        except (ValueError, stripe.error.SignatureVerificationError):
            return None

        if event["type"] == "payment_intent.succeeded":
            pi = event["data"]["object"]
            svc = OrderLifecycleService(db)
            order = await svc.finalize_successful_order(pi["id"])
            if order:
                await db.commit()
                return str(order.id)

        elif event["type"] == "payment_intent.payment_failed":
            pi = event["data"]["object"]
            stmt = select(Order).where(Order.payment_intent_id == pi["id"])
            order = (await db.exec(stmt)).one_or_none()
            if order and order.status != OrderStatus.PAID:
                order.status = OrderStatus.PAYMENT_FAILED
                db.add(order)
                await db.commit()

        return None


def get_stripe_adapter() -> StripeAdapter:
    """Factory — returns CheckoutSessionAdapter when enabled, else PaymentIntentAdapter."""
    if getattr(settings, "use_checkout_sessions", False):
        return CheckoutSessionAdapter()
    return PaymentIntentAdapter()
