import pytest
from app.database import models

SAMPLE_PAYLOAD_1 = {
    "name": "Alpha Corp",
    "industry": "Retail",
    "age": 4,
    "employees": 15,
    "annual_revenue": 900000.0,
    "monthly_cash_flow": 60000.0,
    "monthly_expenses": 50000.0,
    "existing_debt": 100000.0,
    "digital_transactions": 500,
    "utility_payment_score": 88.0,
    "invoice_payment_score": 85.0,
    "previous_defaults": 0
}

SAMPLE_PAYLOAD_2 = {
    "name": "Beta Enterprises",
    "industry": "Logistics",
    "age": 10,
    "employees": 60,
    "annual_revenue": 4500000.0,
    "monthly_cash_flow": 300000.0,
    "monthly_expenses": 250000.0,
    "existing_debt": 600000.0,
    "digital_transactions": 900,
    "utility_payment_score": 94.0,
    "invoice_payment_score": 92.0,
    "previous_defaults": 0
}

SAMPLE_PAYLOAD_3 = {
    "name": "Alpha Manufacturing",
    "industry": "Manufacturing",
    "age": 7,
    "employees": 40,
    "annual_revenue": 2200000.0,
    "monthly_cash_flow": 150000.0,
    "monthly_expenses": 110000.0,
    "existing_debt": 400000.0,
    "digital_transactions": 600,
    "utility_payment_score": 75.0,
    "invoice_payment_score": 70.0,
    "previous_defaults": 1
}

def test_strict_user_data_isolation(client, auth_headers_user1, auth_headers_user2):
    # User 1 submits an assessment
    res1 = client.post("/api/predict", json=SAMPLE_PAYLOAD_1, headers=auth_headers_user1)
    assert res1.status_code == 200
    user1_assessment_id = res1.json()["assessment_id"]

    # User 2 submits an assessment
    res2 = client.post("/api/predict", json=SAMPLE_PAYLOAD_2, headers=auth_headers_user2)
    assert res2.status_code == 200
    user2_assessment_id = res2.json()["assessment_id"]

    # User 1 list assessments -> should only see Alpha Corp
    list1 = client.get("/api/assessments", headers=auth_headers_user1)
    assert list1.status_code == 200
    items1 = list1.json()
    assert len(items1) == 1
    assert items1[0]["id"] == user1_assessment_id
    assert items1[0]["business_name"] == "Alpha Corp"

    # User 2 list assessments -> should only see Beta Enterprises
    list2 = client.get("/api/assessments", headers=auth_headers_user2)
    assert list2.status_code == 200
    items2 = list2.json()
    assert len(items2) == 1
    assert items2[0]["id"] == user2_assessment_id
    assert items2[0]["business_name"] == "Beta Enterprises"

    # User 1 tries to access User 2's assessment details -> 403 Forbidden
    cross_access = client.get(f"/api/assessments/{user2_assessment_id}", headers=auth_headers_user1)
    assert cross_access.status_code == 403
    assert "Not authorized" in cross_access.json()["detail"]

    # User 2 tries to access User 1's assessment details -> 403 Forbidden
    cross_access2 = client.get(f"/api/assessments/{user1_assessment_id}", headers=auth_headers_user2)
    assert cross_access2.status_code == 403

def test_dashboard_stats_calculation(client, auth_headers_user1):
    dashboard = client.get("/api/assessments/dashboard", headers=auth_headers_user1)
    assert dashboard.status_code == 200
    data = dashboard.json()

    assert "total_assessments" in data
    assert "low_risk_count" in data
    assert "medium_risk_count" in data
    assert "high_risk_count" in data
    assert "recent_assessments" in data
    assert "risk_distribution" in data
    assert "assessment_trends" in data
    assert len(data["assessment_trends"]) == 7

def test_assessment_pagination_and_filtering(client, auth_headers_user1, db_session):
    # Ensure User 1 has 2 assessments
    res1 = client.post("/api/predict", json=SAMPLE_PAYLOAD_1, headers=auth_headers_user1)
    assert res1.status_code == 200
    ass1_id = res1.json()["assessment_id"]

    res3 = client.post("/api/predict", json=SAMPLE_PAYLOAD_3, headers=auth_headers_user1)
    assert res3.status_code == 200
    ass3_id = res3.json()["assessment_id"]

    # Test Pagination Page 1 with limit 1
    resp_p1 = client.get("/api/assessments?page=1&limit=1", headers=auth_headers_user1)
    assert resp_p1.status_code == 200
    p1_data = resp_p1.json()
    assert "items" in p1_data
    assert p1_data["page"] == 1
    assert p1_data["limit"] == 1
    assert p1_data["total"] >= 2
    assert p1_data["total_pages"] >= 2
    assert len(p1_data["items"]) == 1

    # Test Pagination Page 2 with limit 1
    resp_p2 = client.get("/api/assessments?page=2&limit=1", headers=auth_headers_user1)
    assert resp_p2.status_code == 200
    p2_data = resp_p2.json()
    assert p2_data["page"] == 2
    assert len(p2_data["items"]) == 1
    assert p2_data["items"][0]["id"] != p1_data["items"][0]["id"]

    # Test Search filter (by business name query 'Alpha')
    resp_search = client.get("/api/assessments?q=Alpha&page=1&limit=10", headers=auth_headers_user1)
    assert resp_search.status_code == 200
    search_data = resp_search.json()
    assert all("Alpha" in item["business_name"] for item in search_data["items"])

    # Test Review Status filter ('pending')
    resp_review = client.get("/api/assessments?review_status=pending&page=1&limit=10", headers=auth_headers_user1)
    assert resp_review.status_code == 200
    review_data = resp_review.json()
    assert all(item["review_status"] == "pending" for item in review_data["items"])

    # Test Whitelist sorting (annual_revenue desc)
    resp_sort = client.get("/api/assessments?sort_by=annual_revenue&sort_order=desc&page=1&limit=10", headers=auth_headers_user1)
    assert resp_sort.status_code == 200
    sort_data = resp_sort.json()
    revenues = [item["annual_revenue"] for item in sort_data["items"] if item["annual_revenue"] is not None]
    if len(revenues) >= 2:
        assert revenues[0] >= revenues[1]
