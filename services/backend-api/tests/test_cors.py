from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
import pytest

SUBDOMAIN_REGEX = r"https://(?:[a-z0-9-]+\.)?amoagou\.com"


def build_app(
    allowed_origins: list[str],
    allow_origin_regex: str | None = None,
) -> TestClient:
    app = FastAPI()

    @app.get("/health")
    def health():
        return {"ok": True}

    has_wildcard = "*" in allowed_origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=allow_origin_regex,
        allow_credentials=not has_wildcard,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Tenant-ID"],
    )
    return TestClient(app)


def preflight(client: TestClient, origin: str) -> pytest.Response:
    return client.options(
        "/health",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        },
    )


@pytest.fixture
def exact_origins_client() -> TestClient:
    return build_app(
        allowed_origins=["http://localhost:3000", "http://localhost:3001"],
        allow_origin_regex=SUBDOMAIN_REGEX,
    )


class TestCorsExactOrigins:
    def test_exact_origin_preflight_allowed(self, exact_origins_client):
        res = preflight(exact_origins_client, "http://localhost:3000")
        assert res.status_code == 200
        assert res.headers["Access-Control-Allow-Origin"] == "http://localhost:3000"
        assert res.headers["Access-Control-Allow-Credentials"] == "true"
        assert res.headers["Vary"] == "Origin"

    def test_exact_origin_simple_request_allowed(self, exact_origins_client):
        res = exact_origins_client.get("/health", headers={"Origin": "http://localhost:3001"})
        assert res.status_code == 200
        assert res.headers["Access-Control-Allow-Origin"] == "http://localhost:3001"
        assert res.headers["Access-Control-Allow-Credentials"] == "true"
        assert "X-Tenant-ID" in res.headers["Access-Control-Expose-Headers"]


class TestCorsRegex:
    def test_subdomain_preflight_allowed(self, exact_origins_client):
        res = preflight(exact_origins_client, "https://tenant-a.amoagou.com")
        assert res.status_code == 200
        assert res.headers["Access-Control-Allow-Origin"] == "https://tenant-a.amoagou.com"
        assert res.headers["Access-Control-Allow-Credentials"] == "true"
        assert res.headers["Vary"] == "Origin"

    def test_nested_subdomain_preflight_allowed(self, exact_origins_client):
        res = preflight(exact_origins_client, "https://admin.amoagou.com")
        assert res.status_code == 200
        assert res.headers["Access-Control-Allow-Origin"] == "https://admin.amoagou.com"

    def test_apex_domain_preflight_allowed(self, exact_origins_client):
        res = preflight(exact_origins_client, "https://amoagou.com")
        assert res.status_code == 200
        assert res.headers["Access-Control-Allow-Origin"] == "https://amoagou.com"

    def test_subdomain_simple_request_allowed(self, exact_origins_client):
        res = exact_origins_client.get(
            "/health",
            headers={"Origin": "https://tenant-a.amoagou.com"},
        )
        assert res.status_code == 200
        assert res.headers["Access-Control-Allow-Origin"] == "https://tenant-a.amoagou.com"
        assert res.headers["Access-Control-Allow-Credentials"] == "true"

    def test_unauthorized_origin_rejected(self, exact_origins_client):
        res = preflight(exact_origins_client, "https://unauthorized.com")
        assert res.status_code == 400
        assert "Access-Control-Allow-Origin" not in res.headers

    def test_unauthorized_origin_simple_request_no_header(self, exact_origins_client):
        res = exact_origins_client.get("/health", headers={"Origin": "https://unauthorized.com"})
        assert res.status_code == 200
        assert "Access-Control-Allow-Origin" not in res.headers

    def test_unrelated_regex_not_matched(self):
        client = build_app(
            allowed_origins=["http://localhost:3000"],
            allow_origin_regex=r"https://(?:[a-z0-9-]+\.)?example\.com",
        )
        res = preflight(client, "https://tenant-a.amoagou.com")
        assert res.status_code == 400
        assert "Access-Control-Allow-Origin" not in res.headers


class TestCorsWildcardFallback:
    def test_wildcard_preflight_allow_all_no_credentials(self):
        client = build_app(allowed_origins=["*"])
        res = preflight(client, "https://anything.com")
        assert res.status_code == 200
        assert res.headers["Access-Control-Allow-Origin"] == "*"
        assert "Access-Control-Allow-Credentials" not in res.headers

    def test_wildcard_simple_request_allow_all_no_credentials(self):
        client = build_app(allowed_origins=["*"])
        res = client.get("/health", headers={"Origin": "https://anything.com"})
        assert res.status_code == 200
        assert res.headers["Access-Control-Allow-Origin"] == "*"
        assert "Access-Control-Allow-Credentials" not in res.headers

    def test_wildcard_regex_still_allow_all(self):
        client = build_app(allowed_origins=["*"], allow_origin_regex=SUBDOMAIN_REGEX)
        res = preflight(client, "https://unrelated.com")
        assert res.status_code == 200
        assert res.headers["Access-Control-Allow-Origin"] == "*"
