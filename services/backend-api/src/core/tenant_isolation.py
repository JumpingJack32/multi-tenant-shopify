from contextvars import ContextVar
from uuid import UUID

from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

from src.config import settings
from src.dependencies import current_tenant_id

# Track if tenant isolation is enabled
_tenant_isolation_enabled: bool = settings.tenant_isolation_enabled

# Track admin/superadmin users who bypass tenant filtering
_admin_tenant_ids: set[UUID] = set()


def is_tenant_isolation_enabled() -> bool:
    """Check if tenant isolation is enabled."""
    return _tenant_isolation_enabled


def set_tenant_isolation_enabled(enabled: bool) -> None:
    """Enable or disable tenant isolation."""
    global _tenant_isolation_enabled
    _tenant_isolation_enabled = enabled


def add_admin_tenant_id(tenant_id: UUID) -> None:
    """Add a tenant ID to the admin bypass list."""
    _admin_tenant_ids.add(tenant_id)


def remove_admin_tenant_id(tenant_id: UUID) -> None:
    """Remove a tenant ID from the admin bypass list."""
    _admin_tenant_ids.discard(tenant_id)


def is_admin_tenant(tenant_id: UUID) -> bool:
    """Check if a tenant ID is in the admin bypass list."""
    return tenant_id in _admin_tenant_ids


def _should_apply_tenant_filter(statement: Select) -> bool:
    """Check if a select statement should be filtered by tenant_id."""
    from src.orm.base import BaseModel

    # Get all tables referenced in the statement
    tables = set()
    for from_obj in statement.get_final_froms():
        if hasattr(from_obj, "name"):
            tables.add(from_obj.name)

    # Skip filtering for tenant-level tables
    excluded_tables = {"tenants", "tenant_users", "clerk_webhook_events"}
    if tables & excluded_tables:
        return False

    # Check if any table has a tenant_id column
    if hasattr(BaseModel, "__table__") and BaseModel.__table__.metadata is not None:
        for table_name in tables:
            if table_name in BaseModel.__table__.metadata.tables:
                table = BaseModel.__table__.metadata.tables[table_name]
                if "tenant_id" in table.columns:
                    return True

    return False


def setup_tenant_isolation():
    """Set up tenant isolation event listeners on Session class."""
    from src.orm.base import BaseModel

    if not is_tenant_isolation_enabled():
        return

    @event.listens_for(Session, "do_orm_execute")
    def receive_do_orm_execute(orm_execute_state):
        """Inject tenant criteria into ORM executions."""
        # Only apply to SELECT statements
        if not isinstance(orm_execute_state.statement, Select):
            return

        # Get the current tenant
        try:
            tenant = current_tenant_id.get()
            # Skip if tenant is unset or admin
            if tenant == UUID("00000000-0000-0000-0000-000000000000") or is_admin_tenant(tenant):
                return
        except Exception:
            return

        # Only apply filter to statements that involve tables with tenant_id
        if not _should_apply_tenant_filter(orm_execute_state.statement):
            return

        # Apply tenant filter
        orm_execute_state.statement = orm_execute_state.statement.where(
            BaseModel.tenant_id == tenant  # type: ignore[attr-defined]
        )


def reset_tenant_context():
    """Reset the tenant context for the current request."""
    current_tenant_id.set(UUID("00000000-0000-0000-0000-000000000000"))


def set_tenant_context(tenant_id: UUID) -> None:
    """Set the tenant context for the current request."""
    current_tenant_id.set(tenant_id)


def get_current_tenant() -> UUID | None:
    """Get the current tenant ID from context."""
    try:
        tenant = current_tenant_id.get()
        if tenant == UUID("00000000-0000-0000-0000-000000000000"):
            return None
        return tenant
    except Exception:
        return None
