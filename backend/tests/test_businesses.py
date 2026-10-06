import pytest
from fastapi.testclient import TestClient

def test_business_crud_and_isolation(client: TestClient, test_user_headers: dict):
    # 1. Create Business
    create_payload = {
        "name": "Omni Corp Solutions",
        "industry": "Services",
        "location": "San Francisco, CA",
        "description": "Tech and consulting MSME",
        "age": 4,
        "employees": 15
    }
    res = client.post("/api/businesses", json=create_payload, headers=test_user_headers)
    assert res.status_code == 201
    b_data = res.json()
    b_id = b_data["id"]
    assert b_data["name"] == "Omni Corp Solutions"
    assert b_data["location"] == "San Francisco, CA"

    # 2. Get List
    res = client.get("/api/businesses", headers=test_user_headers)
    assert res.status_code == 200
    b_list = res.json()
    assert any(b["id"] == b_id for b in b_list)

    # 3. Get Details
    res = client.get(f"/api/businesses/{b_id}", headers=test_user_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Omni Corp Solutions"

    # 4. Update Business
    update_payload = {"location": "Oakland, CA", "employees": 22}
    res = client.put(f"/api/businesses/{b_id}", json=update_payload, headers=test_user_headers)
    assert res.status_code == 200
    assert res.json()["location"] == "Oakland, CA"
    assert res.json()["employees"] == 22

    # 5. Delete Business
    res = client.delete(f"/api/businesses/{b_id}", headers=test_user_headers)
    assert res.status_code == 204

    # 6. Verify 404 after deletion
    res = client.get(f"/api/businesses/{b_id}", headers=test_user_headers)
    assert res.status_code == 404
