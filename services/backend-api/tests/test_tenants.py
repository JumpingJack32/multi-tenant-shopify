from uuid import uuid4

from fastapi.testclient import TestClient


def _unique_slug(prefix: str = "t") -> str:
    return f"{prefix}-{uuid4().hex[:8]}"


def test_create_tenant(client: TestClient):
    slug = _unique_slug("create")
    response = client.post(
        "/api/v1/tenants/",
        json={
            "name": "Test Tenant",
            "slug": slug,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Tenant"
    assert data["slug"] == slug


def test_get_tenants(client: TestClient):
    response = client.get("/api/v1/tenants/")
    assert response.status_code == 200


def test_get_tenant(client: TestClient):
    slug = _unique_slug("get")
    create_resp = client.post(
        "/api/v1/tenants/",
        json={"name": "Get Test", "slug": slug},
    )
    assert create_resp.status_code == 201
    tid = create_resp.json()["tenant_id"]
    response = client.get(f"/api/v1/tenants/{tid}")
    assert response.status_code == 200


def test_update_tenant(client: TestClient):
    slug = _unique_slug("update")
    create_resp = client.post(
        "/api/v1/tenants/",
        json={"name": "Update Test", "slug": slug},
    )
    assert create_resp.status_code == 201
    tid = create_resp.json()["tenant_id"]
    response = client.put(
        f"/api/v1/tenants/{tid}",
        json={"name": "Updated Tenant"},
    )
    assert response.status_code == 200
