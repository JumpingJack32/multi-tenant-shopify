"""Audit log service — records high-risk permission actions.

Actor context (id + email) is passed explicitly into background tasks so it is
not lost once the task runs outside the request lifecycle. The background write
uses its own database session — never the request session, which is closed once
the request completes.
"""

import asyncio
from typing import Any
from uuid import UUID


async def _write(*, tenant_id: UUID, actor_user_id: UUID | None,
                actor_email: str | None, action: str, resource_type: str | None,
                resource_id: str | None, details: dict[str, Any]) -> None:
    from src.database import async_engine
    from sqlmodel.ext.asyncio.session import AsyncSession

    from src.orm.models.audit_log import AuditLog

    async with AsyncSession(async_engine) as db:
        db.add(AuditLog(
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
            actor_email=actor_email,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
        ))
        await db.commit()


def record_audit(
    *,
    tenant_id: UUID,
    actor_user_id: UUID | None,
    actor_email: str | None,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Fire-and-forget audit entry using a dedicated session."""
    asyncio.create_task(_write(
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        actor_email=actor_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
    ))
