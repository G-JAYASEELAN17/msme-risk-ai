import io
import pytest
from fastapi.testclient import TestClient

def test_checklist_initial_state_missing_documents(client: TestClient, auth_headers_user1: dict):
    """Verifies that a new applicant has 0 satisfied categories and submission is blocked."""
    res = client.get("/api/documents/checklist", headers=auth_headers_user1)
    assert res.status_code == 200
    data = res.json()
    assert data["required_categories_total"] == 5
    assert data["satisfied_categories_count"] == 0
    assert data["can_submit_assessment"] is False
    assert len(data["blocking_reasons"]) == 5
    assert "checklist" in data
    assert "additional_documents" in data

    cat_keys = [item["category_key"] for item in data["checklist"]]
    assert cat_keys == [
        "PAN_CARD",
        "BUSINESS_REGISTRATION",
        "BANK_STATEMENT",
        "GST_DOCUMENT",
        "FINANCIAL_STATEMENTS",
    ]


def test_document_upload_invalid_file_types(client: TestClient, auth_headers_user1: dict):
    """Verifies rejection of unsupported file extensions and empty payloads."""
    # Disallowed executable
    files = {"file": ("malicious.exe", io.BytesIO(b"executable data"), "application/octet-stream")}
    res = client.post("/api/documents/upload", files=files, headers=auth_headers_user1)
    assert res.status_code == 400
    assert "Unsupported file extension" in res.json()["detail"]

    # Empty file
    files_empty = {"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")}
    res_empty = client.post("/api/documents/upload", files=files_empty, headers=auth_headers_user1)
    assert res_empty.status_code == 400
    assert "empty file" in res_empty.json()["detail"]


def test_document_upload_duplicate_detection(client: TestClient, auth_headers_user1: dict):
    """Verifies SHA-256 duplicate file detection and prevents duplicate evidence masquerading."""
    file_bytes = b"Sample Bank Statement Content 2026 for MSME Enterprise"
    files1 = {
        "file": ("statement_jan.pdf", io.BytesIO(file_bytes), "application/pdf"),
        "document_type": (None, "BANK_STATEMENT"),
    }
    res1 = client.post("/api/documents/upload", files=files1, headers=auth_headers_user1)
    assert res1.status_code == 201
    doc1 = res1.json()

    # Upload exact same bytes again
    files2 = {
        "file": ("statement_duplicate.pdf", io.BytesIO(file_bytes), "application/pdf"),
        "document_type": (None, "BANK_STATEMENT"),
    }
    res2 = client.post("/api/documents/upload", files=files2, headers=auth_headers_user1)
    assert res2.status_code == 201
    doc2 = res2.json()

    assert doc1["file_hash"] == doc2["file_hash"]

    # Check verification report flags duplicate
    res_verify = client.get(f"/api/documents/{doc2['id']}/verification", headers=auth_headers_user1)
    assert res_verify.status_code == 200
    report = res_verify.json()
    assert report["is_duplicate_file"] is True
    assert report["duplicate_with"]["id"] == doc1["id"]


def test_document_statutory_exemption_workflow(client: TestClient, auth_headers_user1: dict):
    """Verifies explicit, auditable statutory exemption application and revocation."""
    # 1. Non-exemptible category (e.g. PAN_CARD) must be rejected
    res_invalid = client.post(
        "/api/documents/exemptions",
        json={"category": "PAN_CARD", "reason": "No PAN available"},
        headers=auth_headers_user1,
    )
    assert res_invalid.status_code == 400
    assert "not eligible for exemption" in res_invalid.json()["detail"]

    # 2. Legitimate statutory exemption for GST_DOCUMENT
    statutory_reason = "Annual turnover is below the statutory GST registration threshold of INR 40 Lakhs."
    res_exempt = client.post(
        "/api/documents/exemptions",
        json={"category": "GST_DOCUMENT", "reason": statutory_reason},
        headers=auth_headers_user1,
    )
    assert res_exempt.status_code == 200
    assert res_exempt.json()["status"] == "success"

    # 3. Verify checklist reflects exemption
    res_check = client.get("/api/documents/checklist", headers=auth_headers_user1)
    assert res_check.status_code == 200
    gst_item = next(item for item in res_check.json()["checklist"] if item["category_key"] == "GST_DOCUMENT")
    assert gst_item["is_exempt"] is True
    assert gst_item["is_satisfied"] is True
    assert gst_item["status"] == "EXEMPT"
    assert gst_item["exemption_reason"] == statutory_reason

    # 4. Revoke exemption
    res_revoke = client.delete("/api/documents/exemptions/GST_DOCUMENT", headers=auth_headers_user1)
    assert res_revoke.status_code == 200

    # 5. Verify checklist shows requirement restored
    res_check2 = client.get("/api/documents/checklist", headers=auth_headers_user1)
    gst_item2 = next(item for item in res_check2.json()["checklist"] if item["category_key"] == "GST_DOCUMENT")
    assert gst_item2["is_exempt"] is False
    assert gst_item2["is_satisfied"] is False
    assert gst_item2["status"] == "NOT_UPLOADED"


def test_validate_submission_readiness_blocks_incomplete(client: TestClient, auth_headers_user1: dict):
    """Verifies server-side rejection (HTTP 422) if an applicant attempts to submit an incomplete assessment."""
    res = client.post("/api/documents/validate-submission", headers=auth_headers_user1)
    assert res.status_code == 422
    err = res.json()["detail"]
    assert "Incomplete documentation" in err["message"]
    assert err["satisfied_count"] < err["total_required"]
    assert len(err["blocking_reasons"]) > 0


def test_validate_submission_readiness_succeeds_when_all_satisfied(
    client: TestClient,
    auth_headers_user1: dict
):
    """
    Verifies that when all 5 categories are satisfied (via upload or statutory exemption),
    the server-side validation endpoint permits submission with HTTP 200.
    """
    # 1. Upload PAN Card
    pan_file = {"file": ("pan_card.png", io.BytesIO(b"PAN_ABCDE1234F_SAMPLE"), "image/png"), "document_type": (None, "PAN_CARD")}
    client.post("/api/documents/upload", files=pan_file, headers=auth_headers_user1)

    # 2. Upload Business Registration (Udyam)
    reg_file = {"file": ("udyam_cert.pdf", io.BytesIO(b"UDYAM_REGISTRATION_CERTIFICATE"), "application/pdf"), "document_type": (None, "BUSINESS_REGISTRATION")}
    client.post("/api/documents/upload", files=reg_file, headers=auth_headers_user1)

    # 3. Upload Bank Statement
    bank_file = {"file": ("bank_stmt_6m.pdf", io.BytesIO(b"BANK_STATEMENT_TRANSACTIONS"), "application/pdf"), "document_type": (None, "BANK_STATEMENT")}
    client.post("/api/documents/upload", files=bank_file, headers=auth_headers_user1)

    # 4. Apply GST Exemption (Turnover under 40L)
    client.post(
        "/api/documents/exemptions",
        json={"category": "GST_DOCUMENT", "reason": "Turnover under 40L limit"},
        headers=auth_headers_user1,
    )

    # 5. Apply Financial Statements Exemption (New Enterprise < 1 Year)
    client.post(
        "/api/documents/exemptions",
        json={"category": "FINANCIAL_STATEMENTS", "reason": "Newly incorporated enterprise < 1 year"},
        headers=auth_headers_user1,
    )

    # Check checklist progress is 5 of 5
    res_check = client.get("/api/documents/checklist", headers=auth_headers_user1)
    assert res_check.status_code == 200
    data = res_check.json()
    assert data["satisfied_categories_count"] == 5
    assert data["can_submit_assessment"] is True
    assert len(data["blocking_reasons"]) == 0

    # Call backend validation endpoint
    res_sub = client.post("/api/documents/validate-submission", headers=auth_headers_user1)
    assert res_sub.status_code == 200
    sub_data = res_sub.json()
    assert sub_data["status"] == "ready"
    assert sub_data["can_submit_assessment"] is True
    assert sub_data["satisfied_categories_count"] == 5


def test_unauthorized_document_access_isolation(
    client: TestClient,
    auth_headers_user1: dict,
    auth_headers_user2: dict
):
    """Enforces multi-tenant data isolation and RBAC security on document endpoints."""
    # User 1 uploads document
    files = {"file": ("confidential_records.pdf", io.BytesIO(b"PRIVATE_FINANCIAL_RECORDS"), "application/pdf")}
    res_upload = client.post("/api/documents/upload", files=files, headers=auth_headers_user1)
    assert res_upload.status_code == 201
    doc_id = res_upload.json()["id"]

    # User 2 attempts to view document -> 404
    res_get = client.get(f"/api/documents/{doc_id}", headers=auth_headers_user2)
    assert res_get.status_code == 404

    # User 2 attempts to download -> 404
    res_download = client.get(f"/api/documents/{doc_id}/download", headers=auth_headers_user2)
    assert res_download.status_code == 404

    # User 2 attempts to delete document -> 403 or 404
    res_delete = client.delete(f"/api/documents/{doc_id}", headers=auth_headers_user2)
    assert res_delete.status_code in [403, 404]
