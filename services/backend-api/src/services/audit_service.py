"""Audit log service — records high-risk permission actions.

Actor context (id + email) is passed explicitly into background tasks so it is
not lost once the task runs outside the request lifecycle.
"""

import asyncio
from typing import Any
from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.audit_log import AuditLog


async def _write(db: AsyncSession, *, tenant_id: UUID, actor_user_id: UUID | None,
                actor_email: str | None, action: str, resource_type: str | None,
                resource_id: str | None, details: dict[str, Any]) -> None:
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
    db: AsyncSession,
    *,
    tenant_id: UUID,
    actor_user_id: UUID | None,
    actor_email: str | None,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """Fire-and-forget audit entry. Actor fields are explicit so they survive
    the background task boundary (never rely on request state)."""
    asyncio.create_task(_write(
        db,
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        actor_email=actor_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
    ))
