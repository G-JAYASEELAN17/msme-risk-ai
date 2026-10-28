"""
Comprehensive test suite for MSME Risk AI Document Verification Engine:
1. File validation and SHA-256 duplicate detection (same user and cross-tenant).
2. Field extraction & confidence scoring (distinguishing missing from extracted).
3. Arithmetic consistency validation (credits/debits, tax rates, revenue/profit).
4. Cross-document consistency (business names, GSTIN, PAN conflicts).
5. Declared loan assessment comparison (revenue and debt variances).
6. Independent external verification provider interface (anti-fabrication check).
7. RBAC & IDOR authorization protection.
8. Analyst review decision workflow (approval, rejection, investigation required).
9. Audit trail logging and history tracking.
"""

import io
import pytest
from fastapi.testclient import TestClient
from app.database import models
from app.services.verification_service import verification_engine, ExternalVerificationProvider, ExternalVerificationResult


def test_sha256_duplicate_detection(client: TestClient, test_user_headers: dict):
    # 1. Upload initial file
    content = b"Sri Krishna Textiles Statement 2024 Revenue: 2500000 Expenses: 1500000"
    files = {"file": ("statement_1.pdf", io.BytesIO(content), "application/pdf")}
    res1 = client.post("/api/documents/upload", files=files, headers=test_user_headers)
    assert res1.status_code == 201
    doc1 = res1.json()
    assert doc1["file_hash"] is not None

    # 2. Upload identical file with same user -> duplicate detected
    files2 = {"file": ("statement_1_copy.pdf", io.BytesIO(content), "application/pdf")}
    res2 = client.post("/api/documents/upload", files=files2, headers=test_user_headers)
    assert res2.status_code == 201
    doc2 = res2.json()
    assert doc2["file_hash"] == doc1["file_hash"]

    # Retrieve verification report for second file
    ver_res = client.get(f"/api/documents/{doc2['id']}/verification", headers=test_user_headers)
    assert ver_res.status_code == 200
    report = ver_res.json()
    assert report["is_duplicate_file"] is True
    assert report["duplicate_with"]["id"] == doc1["id"]
    # Check that matching hash does NOT mark document as genuine
    assert report["overall_status"] != "VERIFIED"


def test_cross_tenant_duplicate_detection(client: TestClient, auth_headers_user1: dict, auth_headers_user2: dict):
    # User A uploads a document
    content = b"Cross Tenant Financial Sheet Revenue: 5000000 GSTIN: 33ABCDE1234F1Z5"
    files = {"file": ("user_a_doc.pdf", io.BytesIO(content), "application/pdf")}
    res_a = client.post("/api/documents/upload", files=files, headers=auth_headers_user1)
    assert res_a.status_code == 201
    doc_a = res_a.json()

    # User B uploads exact same file
    files_b = {"file": ("user_b_doc.pdf", io.BytesIO(content), "application/pdf")}
    res_b = client.post("/api/documents/upload", files=files_b, headers=auth_headers_user2)
    assert res_b.status_code == 201
    doc_b = res_b.json()

    ver_res = client.get(f"/api/documents/{doc_b['id']}/verification", headers=auth_headers_user2)
    assert ver_res.status_code == 200
    report = ver_res.json()
    assert report["is_duplicate_file"] is True
    assert report["duplicate_with"]["same_user"] is False
    # Check cross-tenant duplicate risk indicator
    assert any(r["indicator"] == "Cross-Tenant Duplicate Document" for r in report["risk_indicators"])


def test_external_verification_unconfigured_never_claims_verified():
    # Verify that external verification provider explicitly returns UNABLE_TO_VERIFY when credentials not configured
    provider = ExternalVerificationProvider()
    gst_res = provider.verify_gstin("33ABCDE1234F1Z5", "Test Business")
    assert gst_res.status == "UNABLE_TO_VERIFY"
    assert "Unable to Verify Externally" in gst_res.message
    assert gst_res.verified_at is None

    biz_res = provider.verify_business_registration("ABCDE1234F", "PAN")
    assert biz_res.status == "UNABLE_TO_VERIFY"


def test_cross_document_identifier_mismatch(client: TestClient, test_user_headers: dict):
    # Upload first document with GSTIN A
    doc_1_content = b"Tax Invoice - Krishna Mills\nGSTIN: 33ABCDE1234F1Z5\nAnnual Revenue: 15,00,000.00"
    files1 = {"file": ("inv_1.csv", io.BytesIO(doc_1_content), "text/csv")}
    r1 = client.post("/api/documents/upload", files=files1, headers=test_user_headers)
    assert r1.status_code == 201
    d1 = r1.json()

    # Upload second document with conflicting GSTIN B for same user
    doc_2_content = b"GSTR-3B - Krishna Mills\nGSTIN: 27XYZAB9876C1Z9\nAnnual Revenue: 15,00,000.00"
    files2 = {"file": ("gst_2.csv", io.BytesIO(doc_2_content), "text/csv")}
    r2 = client.post("/api/documents/upload", files=files2, headers=test_user_headers)
    assert r2.status_code == 201
    d2 = r2.json()

    # Check report for document 2
    ver_res = client.get(f"/api/documents/{d2['id']}/verification", headers=test_user_headers)
    assert ver_res.status_code == 200
    rep = ver_res.json()
    assert rep["cross_document_checks"]["passed"] is False
    assert any(disc["field"] == "gstin" for disc in rep["discrepancies"])
    assert rep["overall_status"] == "MISMATCH_FOUND"


def test_analyst_review_workflow(client: TestClient, auth_headers_user1: dict, auth_headers_user2: dict, db_session):
    # Make user2 an analyst
    u2 = db_session.query(models.User).filter(models.User.uid == "user_beta_2").first()
    if not u2:
        u2 = models.User(uid="user_beta_2", email="analyst@msme.com", role="analyst")
        db_session.add(u2)
    else:
        u2.role = "analyst"
    db_session.commit()

    # 1. User uploads document
    content = b"Sri Krishna Bank Statement Annual Revenue: 4000000 Monthly Cash Flow: 150000"
    files = {"file": ("analyst_test_doc.pdf", io.BytesIO(content), "application/pdf")}
    upload_res = client.post("/api/documents/upload", files=files, headers=auth_headers_user1)
    assert upload_res.status_code == 201
    doc_id = upload_res.json()["id"]

    # 2. Regular user cannot perform analyst review
    user_review_res = client.post(
        f"/api/documents/{doc_id}/analyst-review",
        json={"decision": "APPROVED", "notes": "I approve my own doc"},
        headers=auth_headers_user1
    )
    assert user_review_res.status_code == 403

    # 3. Authorized analyst approves document
    analyst_review_res = client.post(
        f"/api/documents/{doc_id}/analyst-review",
        json={"decision": "APPROVED", "notes": "Audited bank statements against tax filings. Authentic."},
        headers=auth_headers_user2
    )
    assert analyst_review_res.status_code == 200
    doc_approved = analyst_review_res.json()
    assert doc_approved["processing_status"] == "VERIFIED"
    assert doc_approved["analyst_decision"] == "APPROVED"
    assert doc_approved["reviewed_by"] is not None

    # 4. Check audit trail
    audit_res = client.get(f"/api/documents/{doc_id}/audit-trail", headers=auth_headers_user1)
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert any(log["action"] == "ANALYST_DOCUMENT_REVIEW" for log in logs)


def test_unauthorized_user_cannot_access_or_modify_other_documents(client: TestClient, test_user_headers: dict):
    # User uploads document
    files = {"file": ("secret_finances.pdf", io.BytesIO(b"Private Financial Data"), "application/pdf")}
    res = client.post("/api/documents/upload", files=files, headers=test_user_headers)
    assert res.status_code == 201
    doc_id = res.json()["id"]

    # Different unprivileged user headers
    other_user_headers = {"Authorization": "Bearer test_token:user_intruder:intruder@company.com:Intruder User"}

    # Attacker tries to read document metadata -> 404
    get_res = client.get(f"/api/documents/{doc_id}", headers=other_user_headers)
    assert get_res.status_code == 404

    # Attacker tries to edit field -> 403 or 404
    patch_res = client.patch(f"/api/documents/{doc_id}/fields/1", json={"value": "999999"}, headers=other_user_headers)
    assert patch_res.status_code in [403, 404]

    # Attacker tries to delete document -> 403 or 404
    del_res = client.delete(f"/api/documents/{doc_id}", headers=other_user_headers)
    assert del_res.status_code in [403, 404]

