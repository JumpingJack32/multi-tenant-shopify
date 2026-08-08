"""Audit log service — records high-risk permission actions.

Actor context (id + email) is passed explicitly into background tasks so it is
not lost once the task runs outside the request lifecycle. The background write
uses its own database session — never the request session, which is closed once
the request completes.
"""

import asyncio
import csv
from datetime import datetime
import io
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.audit_log import AuditLog


class AuditLogFilters:
    """Filter criteria shared by the paginated list and CSV export endpoints."""

    def __init__(
        self,
        action: str | None = None,
        actor_email: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> None:
        self.action = action
        self.actor_email = actor_email
        self.resource_type = resource_type
        self.resource_id = resource_id
        self.start_date = start_date
        self.end_date = end_date


def build_audit_log_query(
    tenant_id: UUID,
    filters: AuditLogFilters,
):
    """Build a shared filtered query for audit logs (list + export identical).

    Always tenant-scoped; optional filters applied conditionally.
    actor_email uses ILIKE bounded by the tenant + created_at index.
    """
    stmt = select(AuditLog).where(AuditLog.tenant_id == tenant_id)

    if filters.action:
        stmt = stmt.where(AuditLog.action == filters.action)
    if filters.actor_email:
        stmt = stmt.where(AuditLog.actor_email.ilike(f"%{filters.actor_email.strip()}%"))
    if filters.resource_type:
        stmt = stmt.where(AuditLog.resource_type == filters.resource_type)
    if filters.resource_id:
        stmt = stmt.where(AuditLog.resource_id == filters.resource_id)
    if filters.start_date:
        stmt = stmt.where(AuditLog.created_at >= datetime.fromisoformat(filters.start_date))
    if filters.end_date:
        stmt = stmt.where(AuditLog.created_at <= datetime.fromisoformat(filters.end_date))

    return stmt.order_by(AuditLog.created_at.desc())


async def count_audit_logs(db: AsyncSession, tenant_id: UUID, filters: AuditLogFilters) -> int:
    """Count matching audit logs for pagination metadata."""
    base = build_audit_log_query(tenant_id, filters)
    count_stmt = select(func.count()).select_from(base.subquery())
    result = await db.scalars(count_stmt)
    return result.one()


def _sanitize_csv_cell(value: str) -> str:
    """Prevent spreadsheet formula injection by neutralizing leading = + - @."""
    if value and value[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value


async def export_audit_logs_csv(db: AsyncSession, tenant_id: UUID, filters: AuditLogFilters) -> str:
    """Stream audit logs as CSV with formula-injection-safe details column.

    details is JSON-serialized and written through csv.writer; cells whose first
    character is = + - @ are prefixed with a single quote to prevent spreadsheet
    formula injection.
    """
    import json

    stmt = build_audit_log_query(tenant_id, filters)
    rows = (await db.scalars(stmt)).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "created_at", "actor_email", "action", "resource_type", "resource_id", "details",
    ])
    for log in rows:
        writer.writerow([
            log.created_at.isoformat() if log.created_at else "",
            _sanitize_csv_cell(log.actor_email or ""),
            _sanitize_csv_cell(log.action),
            _sanitize_csv_cell(log.resource_type or ""),
            _sanitize_csv_cell(log.resource_id or ""),
            _sanitize_csv_cell(json.dumps(log.details, ensure_ascii=False) if log.details else ""),
        ])
    return buffer.getvalue()


async def _write(*, tenant_id: UUID, actor_user_id: UUID | None,
                actor_email: str | None, action: str, resource_type: str | None,
                resource_id: str | None, details: dict[str, Any]) -> None:
    from sqlmodel.ext.asyncio.session import AsyncSession

    from src.database import async_engine
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
