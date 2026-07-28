"""SaaS sign-up service — orchestrates tenant provisioning with Stripe billing."""

import uuid
from datetime import datetime, timezone, timedelta

import anyio
from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.config import settings
from src.orm.models.saas_plan import SaaSPlan
from src.orm.models.tenant import Tenant


async def check_slug_available(slug: str, db: AsyncSession) -> bool:
    """Return True if the slug is not taken by any existing tenant."""
    result = await db.execute(
        text("SELECT 1 FROM tenants WHERE slug = :slug"),
        {"slug": slug},
    )
    return result.first() is None


async def signup_tenant(
    name: str,
    slug: str,
    plan_slug: str,
    clerk_user_id: str,
    email: str,
    stripe_payment_method_id: str | None,
    db: AsyncSession,
) -> dict:
    """Create a new tenant, assign plan, set up Stripe billing, and return admin details."""
    # Resolve plan
    plan = (
        await db.exec(
            select(SaaSPlan).where(
                SaaSPlan.slug == plan_slug,
                SaaSPlan.is_public == True,  # noqa: E712
            )
        )
    ).first()
    if not plan:
        raise ValueError(f"Plan '{plan_slug}' not found")

    tenant_id = uuid.uuid4()
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=plan.trial_days)

    # Create tenant
    await db.execute(
        text("""
            INSERT INTO tenants (id, tenant_id, name, slug, plan, status, settings, options, trial_ends_at, created_at, updated_at)
            VALUES (:id, :tid, :name, :slug, :pslug, 'active', :settings, '{}'::jsonb, :trial_end, NOW(), NOW())
        """),
        {
            "id": uuid.uuid4(),
            "tid": tenant_id,
            "name": name,
            "slug": slug,
            "pslug": plan_slug,
            "settings": '{"currency": "GBP"}',
            "trial_end": trial_end,
        },
    )

    # Create TenantUser
    await db.execute(
        text("""
            INSERT INTO tenant_users (id, tenant_id, clerk_user_id, email, password_hash, role, is_active, is_platform_superuser, created_at, updated_at)
            VALUES (:id, :tid, :clerk_id, :email, '', 'owner', true, false, NOW(), NOW())
        """),
        {
            "id": uuid.uuid4(),
            "tid": tenant_id,
            "clerk_id": clerk_user_id,
            "email": email,
        },
    )

    # Stripe billing setup (if key is configured)
    stripe_customer_id = None
    stripe_subscription_id = None

    if settings.stripe_enabled:
        try:
            stripe_customer_id, stripe_subscription_id = await _create_stripe_subscription(
                name=name,
                email=email,
                tenant_id=tenant_id,
                plan=plan,
                payment_method_id=stripe_payment_method_id,
            )

            # Store Stripe IDs on tenant
            metadata = {"stripe_customer_id": stripe_customer_id}
            if stripe_subscription_id:
                metadata["subscription_id"] = stripe_subscription_id
            await db.execute(
                text("""
                    UPDATE tenants SET options = options::jsonb || :metadata::jsonb, updated_at = NOW()
                    WHERE tenant_id = :tid
                """),
                {
                    "tid": tenant_id,
                    "metadata": str(metadata).replace("'", '"'),
                },
            )
        except Exception as exc:
            # Tenant created but Stripe setup failed — log and continue
            print(f"Stripe setup failed for {slug}: {exc}")

    await db.commit()

    admin_url = f"https://admin.{slug}.com" if slug else "/admin"

    return {
        "tenant_id": str(tenant_id),
        "slug": slug,
        "name": name,
        "admin_url": admin_url,
        "trial_ends_at": trial_end.isoformat(),
    }


async def _create_stripe_subscription(
    name: str,
    email: str,
    tenant_id: uuid.UUID,
    plan: SaaSPlan,
    payment_method_id: str | None,
) -> tuple[str, str | None]:
    """Create Stripe Customer + Subscription with trial period."""
    import stripe
    stripe.api_key = settings.stripe_secret_key

    def _sync_create() -> tuple[str, str | None]:
        # Create or find customer
        customers = stripe.Customer.list(email=email, limit=1)
        if customers.data:
            customer = customers.data[0]
        else:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={"tenant_id": str(tenant_id)},
            )

        # Attach payment method if provided
        if payment_method_id:
            stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer.id,
            )
            stripe.Customer.modify(
                customer.id,
                invoice_settings={"default_payment_method": payment_method_id},
            )

        # Determine price ID based on plan
        price_id = plan.stripe_price_id_monthly

        # Create subscription with trial
        if price_id:
            sub = stripe.Subscription.create(
                customer=customer.id,
                items=[{"price": price_id}],
                trial_period_days=plan.trial_days,
                metadata={"tenant_id": str(tenant_id)},
                payment_behavior="default_incomplete",
                expand=["latest_invoice.payment_intent"],
            )
            return customer.id, sub.id

        return customer.id, None

    return await anyio.to_thread.run_sync(_sync_create)
