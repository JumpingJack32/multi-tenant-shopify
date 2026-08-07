"""Tests for the RBAC permission catalog and role map."""

import pytest

from src.core.rbac import (
    ALL_PERMISSIONS,
    has_permission,
    is_owner,
    permissions_for_role,
    ROLE_PERMISSIONS,
    validate_permission,
)


class TestPermissionCatalog:
    def test_customers_read_in_all_permissions(self):
        assert "customers.read" in ALL_PERMISSIONS

    def test_finance_has_non_pii_customer_read(self):
        assert "customers.read" in ROLE_PERMISSIONS["finance"]
        assert "customers.read_pii" not in ROLE_PERMISSIONS["finance"]
        assert "customers.export" not in ROLE_PERMISSIONS["finance"]

    def test_owner_has_everything(self):
        for perm in ALL_PERMISSIONS:
            assert perm in ROLE_PERMISSIONS["owner"]

    def test_admin_has_all_except_owner_only(self):
        assert "settings.transfer_ownership" not in ROLE_PERMISSIONS["admin"]
        assert "settings.manage_billing" not in ROLE_PERMISSIONS["admin"]
        assert "orders.refund" in ROLE_PERMISSIONS["admin"]

    def test_ops_manager_permissions(self):
        ops = ROLE_PERMISSIONS["ops_manager"]
        assert "orders.refund" in ops
        assert "inventory.override" in ops
        assert "store_credit.issue" in ops
        assert "finance.view_payouts" not in ops
        assert "settings.manage_staff" not in ops

    def test_support_agent_has_no_financial_or_export(self):
        sup = ROLE_PERMISSIONS["support_agent"]
        assert "orders.read" in sup
        assert "customers.read_pii" in sup
        assert "finance.view_reports" not in sup
        assert "customers.export" not in sup
        assert "orders.refund" not in sup

    def test_catalog_specialist_isolated(self):
        cat = ROLE_PERMISSIONS["catalog_specialist"]
        assert "products.edit" in cat
        assert "orders.read" not in cat
        assert "customers.read" not in cat
        assert "finance.view_payouts" not in cat

    def test_marketing_manager_no_fulfillment_or_refund(self):
        mk = ROLE_PERMISSIONS["marketing_manager"]
        assert "marketing.campaigns" in mk
        assert "marketing.discounts" in mk
        assert "orders.refund" not in mk
        assert "inventory.override" not in mk

    def test_finance_read_only(self):
        fin = ROLE_PERMISSIONS["finance"]
        assert "orders.read" in fin
        assert "finance.view_reports" in fin
        assert "products.edit" not in fin
        assert "orders.refund" not in fin
        assert "store_credit.issue" not in fin


class TestHasPermission:
    def test_known_role_grants(self):
        assert has_permission("admin", "orders.refund")
        assert not has_permission("support_agent", "finance.view_payouts")

    def test_unknown_role_gets_none(self):
        assert permissions_for_role("ghost") == set()
        assert not has_permission("ghost", "orders.read")

    def test_superuser_bypass(self):
        assert has_permission("anything", "customers.export", is_platform_superuser=True)

    def test_owner_guard(self):
        assert is_owner("owner")
        assert not is_owner("admin")
        assert is_owner("member", is_platform_superuser=True)


class TestValidatePermission:
    def test_valid(self):
        validate_permission("orders.refund")

    def test_invalid_raises(self):
        with pytest.raises(ValueError):
            validate_permission("bogus.key")
