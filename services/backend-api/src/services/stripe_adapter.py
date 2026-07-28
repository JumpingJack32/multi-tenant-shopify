"""Stripe adapter — abstracts Checkout Sessions vs PaymentIntent behind a common interface.

All Stripe SDK calls run via anyio.to_thread.run_sync to avoid blocking
the asyncio event loop with synchronous HTTP requests."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID, uuid4

import anyio
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.config import settings


@dataclass
class CheckoutItem:
    variant_id: UUID
    quantity: int
    subscription_plan_id: UUID | None = None


@dataclass
class CheckoutResult:
    session_id: str | None = None
    session_url: str | None = None
    client_secret: str | None = None


class StripeAdapter(ABC):
    """Interface for Stripe payment flows — all implementations use anyio."""

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

    @abstractmethod
    async def create_customer_portal_session(
        self,
        customer_email: str,
        tenant_id: UUID,
        return_url: str,
    ) -> str:
        """Create a Stripe Customer Portal session URL."""
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

        from src.orm.models.order import Order, OrderItem as OrderItemModel, OrderStatus, PaymentStatus
        from src.orm.models.product import Variant

        line_items = []
        total = 0
        resolved_variants: dict[UUID, "Variant"] = {}

        for ci in items:
            stmt = select(Variant).where(Variant.id == ci.variant_id).options(
                selectinload(Variant.product)
            )
            variant = (await db.exec(stmt)).one_or_none()
            if not variant or not variant.is_active:
                raise HTTPException(status_code=400, detail=f"Variant {ci.variant_id} not found")
            if variant.inventory_quantity < ci.quantity:
                raise HTTPException(status_code=409, detail=f"Insufficient stock for {variant.sku}")

            resolved_variants[ci.variant_id] = variant
            product_name = variant.product.name if variant.product else "Product"
            total += variant.price * ci.quantity
            product_data: dict = {"name": product_name}
            if variant.tax_code:
                product_data["tax_code"] = variant.tax_code
            line_items.append({
                "price_data": {
                    "currency": "gbp",
                    "product_data": product_data,
                    "unit_amount": variant.price,
                },
                "quantity": ci.quantity,
            })

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

        for ci in items:
            variant = resolved_variants[ci.variant_id]
            db.add(OrderItemModel(
                order_id=order.id, tenant_id=tenant_id, variant_id=ci.variant_id,
                product_id=variant.product_id,
                product_name=variant.product.name if variant.product else "Product",
                sku=variant.sku, quantity=ci.quantity,
                unit_price=variant.price, total_price=variant.price * ci.quantity,
            ))
        await db.flush()

        def _sync_create_session():
            import stripe
            stripe.api_key = settings.stripe_secret_key
            return stripe.checkout.Session.create(
                line_items=line_items, mode="payment",
                customer_email=customer_email,
                success_url=success_url, cancel_url=cancel_url,
                metadata={"tenant_id": str(tenant_id), "order_id": str(order.id)},
            )

        session = await anyio.to_thread.run_sync(_sync_create_session)

        order.payment_intent_id = session.id
        db.add(order)
        await db.commit()

        return CheckoutResult(session_id=session.id, session_url=session.url)

    async def create_subscription_checkout(
        self,
        tenant_id: UUID,
        tenant_slug: str,
        customer_email: str,
        items: list[CheckoutItem],
        success_url: str,
        cancel_url: str,
        db: AsyncSession,
    ) -> CheckoutResult:
        """Create a Stripe Checkout Session with recurring subscription prices."""
        from fastapi import HTTPException

        from src.config import settings
        from src.orm.models.product import Variant
        from src.orm.models.subscription import SubscriptionPlan

        sub_line_items = []
        for ci in items:
            if not ci.subscription_plan_id:
                raise HTTPException(status_code=400, detail="Subscription checkout requires subscription_plan_id on all items")

            stmt = select(Variant).where(Variant.id == ci.variant_id).options(selectinload(Variant.product))
            variant = (await db.exec(stmt)).first()
            if not variant or not variant.is_active:
                raise HTTPException(status_code=400, detail=f"Variant {ci.variant_id} not found")

            plan = (await db.exec(select(SubscriptionPlan).where(SubscriptionPlan.id == ci.subscription_plan_id))).first()
            if not plan or not plan.is_active:
                raise HTTPException(status_code=400, detail="Subscription plan not found or inactive")

            product_name = variant.product.name if variant.product else "Product"
            sub_line_items.append({
                "price_data": {
                    "currency": "gbp",
                    "product_data": {"name": product_name},
                    "recurring": {
                        "interval": plan.interval.lower(),
                        "interval_count": plan.interval_count,
                    },
                    "unit_amount": variant.price,
                },
                "quantity": ci.quantity,
            })

        def _sync_create():
            import stripe
            stripe.api_key = settings.stripe_secret_key
            return stripe.checkout.Session.create(
                line_items=sub_line_items, mode="subscription",
                customer_email=customer_email,
                success_url=success_url, cancel_url=cancel_url,
                metadata={"tenant_id": str(tenant_id)},
            )

        session = await anyio.to_thread.run_sync(_sync_create)

        # Store the subscription reference
        from src.orm.models.subscription import CustomerSubscription

        for ci in items:
            sub = CustomerSubscription(
                tenant_id=tenant_id,
                customer_email=customer_email,
                subscription_plan_id=ci.subscription_plan_id,
                stripe_subscription_id=session.id,
                status="active",
            )
            db.add(sub)
        await db.commit()

        return CheckoutResult(session_id=session.id, session_url=session.url)

    async def handle_event(self, payload: bytes, sig_header: str, db: AsyncSession) -> str | None:
        from src.services.order_lifecycle import OrderLifecycleService

        def _sync_construct():
            import stripe
            stripe.api_key = settings.stripe_secret_key
            return stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)

        try:
            event = await anyio.to_thread.run_sync(_sync_construct)
        except Exception:
            return None

        if event["type"] == "checkout.session.completed":
            svc = OrderLifecycleService(db)
            order = await svc.finalize_successful_order(event["data"]["object"]["id"])
            if order:
                await db.commit()
                return str(order.id)

        if event["type"] == "invoice.payment_succeeded":
            from src.orm.models.subscription import CustomerSubscription, SubscriptionPlan

            invoice = event["data"]["object"]
            sub_id = invoice.get("subscription")
            lines = invoice.get("lines", {}).get("data", [])

            if not sub_id or not lines:
                return None

            # Find the CustomerSubscription record
            sub = (
                await db.exec(
                    select(CustomerSubscription).where(
                        CustomerSubscription.stripe_subscription_id == sub_id
                    )
                )
            ).first()

            if not sub:
                return None

            # Create an order record for this recurring payment
            from src.orm.models.order import Order, OrderItem as OrderItemModel, OrderStatus, PaymentStatus
            from src.orm.models.product import Variant

            plan = (await db.exec(
                select(SubscriptionPlan).where(SubscriptionPlan.id == sub.subscription_plan_id)
            )).first()
            if not plan:
                return None

            # Get the variant associated with this product
            variant = (await db.exec(
                select(Variant).where(Variant.product_id == plan.product_id).limit(1)
            )).first()
            if not variant:
                return None

            total = int(invoice.get("total", 0) or 0)
            order = Order(
                tenant_id=sub.tenant_id,
                customer_email=sub.customer_email,
                order_number=f"SUB-{uuid4().hex[:12].upper()}",
                status=OrderStatus.PAID,
                payment_status=PaymentStatus.PAID,
                total=total,
                currency="GBP",
                base_currency="GBP",
            )
            db.add(order)
            await db.flush()

            db.add(OrderItemModel(
                order_id=order.id,
                tenant_id=sub.tenant_id,
                variant_id=variant.id,
                product_id=plan.product_id,
                product_name=variant.product.name if variant.product else "Subscription Item",
                sku=variant.sku,
                quantity=1,
                unit_price=total,
                total_price=total,
            ))
            await db.commit()
            return str(order.id)

        return None

    async def create_customer_portal_session(
        self,
        customer_email: str,
        tenant_id: UUID,
        return_url: str,
    ) -> str:
        def _sync_portal_flow() -> str:
            import stripe
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

        return await anyio.to_thread.run_sync(_sync_portal_flow)


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
        return CheckoutResult(client_secret="stub")

    async def handle_event(self, payload: bytes, sig_header: str, db: AsyncSession) -> str | None:
        from src.orm.models.order import Order, OrderStatus
        from src.services.order_lifecycle import OrderLifecycleService

        def _sync_construct():
            import stripe
            stripe.api_key = settings.stripe_secret_key
            return stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)

        try:
            event = await anyio.to_thread.run_sync(_sync_construct)
        except Exception:
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

    async def create_customer_portal_session(
        self,
        customer_email: str,
        tenant_id: UUID,
        return_url: str,
    ) -> str:
        from fastapi import HTTPException
        raise HTTPException(status_code=501, detail="Customer Portal requires Checkout Sessions")


def get_stripe_adapter() -> StripeAdapter:
    """Factory — returns CheckoutSessionAdapter when enabled, else PaymentIntentAdapter."""
    if getattr(settings, "use_checkout_sessions", False):
        return CheckoutSessionAdapter()
    return PaymentIntentAdapter()
