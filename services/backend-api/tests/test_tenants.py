from fastapi.testclient import TestClient


def test_create_tenant(client: TestClient):
    response = client.post(
        "/api/v1/tenants/",
        json={
            "tenant_id": "00000000-0000-0000-0000-000000000001",
            "name": "Test Tenant",
            "slug": "test-tenant",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Tenant"
    assert data["slug"] == "test-tenant"


def test_get_tenants(client: TestClient):
    response = client.get("/api/v1/tenants/")
    assert response.status_code == 200


def test_get_tenant(client: TestClient):
    response = client.get("/api/v1/tenants/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 200


def test_update_tenant(client: TestClient):
    response = client.put(
        "/api/v1/tenants/00000000-0000-0000-0000-000000000001",
        json={"name": "Updated Tenant"},
    )
    assert response.status_code == 200
