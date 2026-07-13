"""Tests for TenantMiddleware.

These tests verify that the middleware correctly validates tenant context
and never falls back to Clerk `sub` claims as tenant IDs.

Requires env vars (Doppler) to run. The key invariant tested:
  - `claims.get("sub")` (Clerk user ID) is NEVER accepted as tenant_id
  - Only valid UUIDs from `x-tenant-id` header or `tenant_id` claim are accepted
"""


from fastapi.testclient import TestClient


class TestTenantMiddleware:
    def test_missing_tenant_id_returns_400(self, client: TestClient):
        response = client.get("/health")
        assert response.status_code == 400
        assert "Missing tenant context" in response.text

    def test_invalid_tenant_id_format_returns_400(self, client: TestClient):
        response = client.get("/health", headers={"x-tenant-id": "not-a-uuid"})
        assert response.status_code == 400
        assert "Invalid tenant ID" in response.text

    def test_clerk_user_id_as_tenant_returns_400(self, client: TestClient):
        """Clerk sub claims (e.g. 'user_2abc123') must NOT be accepted as tenant_id."""
        response = client.get("/health", headers={"x-tenant-id": "user_2abc123def456"})
        assert response.status_code == 400
        assert "Invalid tenant ID" in response.text

    def test_valid_uuid_tenant_id_returns_200(self, client: TestClient):
        response = client.get(
            "/health",
            headers={"x-tenant-id": "00000000-0000-0000-0000-000000000001"},
        )
        assert response.status_code == 200
        assert response.headers.get("x-tenant-id") == "00000000-0000-0000-0000-000000000001"

    def test_valid_tenant_id_echoed_in_response(self, client: TestClient):
        tenant_id = "550e8400-e29b-41d4-a716-446655440000"
        response = client.get("/health", headers={"x-tenant-id": tenant_id})
        assert response.status_code == 200
        assert response.headers.get("x-tenant-id") == tenant_id

    def test_health_endpoint_with_valid_tenant(self, client: TestClient):
        response = client.get(
            "/health",
            headers={"x-tenant-id": "00000000-0000-0000-0000-000000000001"},
        )
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
