"""Role-Based Access Control — permission catalog and role mapping.

Enforcement is keyed on permission strings (e.g. ``customers.export``), never
role names. This future-proofs custom roles: adding them later only moves the
role→permission map to the database without rewriting route or UI guards.
"""

from functools import lru_cache

ALL_PERMISSIONS: set[str] = {
    # Customers / PII
    "customers.read",
    "customers.read_pii",
    "customers.export",
    # Orders / Financial
    "orders.read",
    "orders.edit",
    "orders.refund",
    "store_credit.issue",
    "finance.view_payouts",
    "finance.view_reports",
    # Catalog / Inventory
    "products.read",
    "products.create",
    "products.edit",
    "products.bulk_price",
    "inventory.view",
    "inventory.override",
    # Marketing
    "marketing.campaigns",
    "marketing.discounts",
    "marketing.analytics",
    # Settings / Security
    "settings.manage_staff",
    "settings.manage_billing",
    "settings.manage_webhooks",
    "settings.manage_api_keys",
    "settings.transfer_ownership",
    "audit_logs.read",
}

# Owner holds every permission.
_ALL_EXCEPT_OWNER = ALL_PERMISSIONS - {
    "settings.transfer_ownership",
    "settings.manage_billing",
}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "owner": ALL_PERMISSIONS,
    "admin": _ALL_EXCEPT_OWNER,
    "ops_manager": {
        "orders.read",
        "orders.edit",
        "orders.refund",
        "inventory.view",
        "inventory.override",
        "store_credit.issue",
    },
    "support_agent": {
        "customers.read",
        "customers.read_pii",
        "orders.read",
        "orders.edit",
    },
    "catalog_specialist": {
        "products.read",
        "products.create",
        "products.edit",
        "products.bulk_price",
        "inventory.view",
    },
    "marketing_manager": {
        "marketing.campaigns",
        "marketing.discounts",
        "marketing.analytics",
        "finance.view_reports",
    },
    "finance": {
        "orders.read",
        "customers.read",
        "finance.view_payouts",
        "finance.view_reports",
        "audit_logs.read",
    },
}

# Roles that may appear in the team-management UI (excludes the implicit
# platform superuser, which is a flag, not a role).
MANAGEABLE_ROLES: list[str] = [
    "owner",
    "admin",
    "ops_manager",
    "support_agent",
    "catalog_specialist",
    "marketing_manager",
    "finance",
]


def permissions_for_role(role: str) -> set[str]:
    """Return the permission set for a role. Unknown roles get none."""
    return ROLE_PERMISSIONS.get(role, set())


def has_permission(role: str, permission: str, is_platform_superuser: bool = False) -> bool:
    """Check whether a role holds a permission. Superuser bypasses all checks."""
    if is_platform_superuser:
        return True
    return permission in permissions_for_role(role)


def is_owner(role: str, is_platform_superuser: bool = False) -> bool:
    """Owners (and superusers) may perform ownership-only actions."""
    return is_platform_superuser or role == "owner"


def validate_permission(permission: str) -> None:
    """Raise if a permission key is not part of the catalog (typo guard)."""
    if permission not in ALL_PERMISSIONS:
        raise ValueError(f"Unknown permission key: {permission}")
