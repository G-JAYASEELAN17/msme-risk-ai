import pytest
from fastapi.testclient import TestClient

def test_global_search(client: TestClient, test_user_headers: dict):
    # 1. Create a searchable business
    b_payload = {
        "name": "Global Search Test MSME",
        "industry": "Logistics",
        "location": "Miami, FL",
        "age": 6,
        "employees": 30
    }
    client.post("/api/businesses", json=b_payload, headers=test_user_headers)

    # 2. Search query
    res = client.get("/api/search?q=Search Test", headers=test_user_headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data["businesses"]) >= 1
    assert any("Global Search Test" in b["name"] for b in data["businesses"])
