import pytest
import io
from fastapi.testclient import TestClient
from app.database import models
from app.services.ocr_service import get_ocr_provider, MockOCRProvider, OCRResult
from app.services.document_classifier import classify_document
from app.services.extraction_service import parse_financial_number, extract_fields_from_pages, OCRPageResult

def test_financial_number_parser():
    # Standard numbers
    assert parse_financial_number("1250000") == 1250000.0
    assert parse_financial_number("1,250,000.00") == 1250000.0
    # Currency symbols
    assert parse_financial_number("₹ 12,50,000.00") == 1250000.0
    assert parse_financial_number("$ 45,000.50") == 45000.5
    # Indian words
    assert parse_financial_number("15.5 Lakhs") == 1550000.0
    assert parse_financial_number("1.2 Cr") == 12000000.0
    # Negative / Invalid / NaN
    assert parse_financial_number("-5000") is None
    assert parse_financial_number("N/A") is None
    assert parse_financial_number("") is None


def test_document_classifier_heuristics():
    # Bank statement
    bs_res = classify_document("HDFC Bank statement account number IFSC Code closing balance", "statement.pdf")
    assert bs_res.document_type == "BANK_STATEMENT"
    assert bs_res.confidence >= 0.70

    # GST
    gst_res = classify_document("Form GSTR-3B GSTIN 33ABCDE1234F1Z5 taxable turnover", "gst_return.pdf")
    assert gst_res.document_type == "GST_DOCUMENT"

    # Invoice
    inv_res = classify_document("Tax Invoice invoice no INV-1002 billed to total amount", "invoice_jan.pdf")
    assert inv_res.document_type == "INVOICE"

    # Utility bill
    ub_res = classify_document("Electricity distribution bill consumer number kwh units consumed", "bescom_bill.pdf")
    assert ub_res.document_type == "UTILITY_BILL"

    # Profit & Loss
    pl_res = classify_document("Audited statement of profit and loss operating expenses net profit ebitda", "pl_statement.pdf")
    assert pl_res.document_type == "PROFIT_LOSS"

    # Balance Sheet
    bal_res = classify_document("Balance sheet total assets current liabilities shareholder equity", "balance_sheet.pdf")
    assert bal_res.document_type == "BALANCE_SHEET"


def test_ocr_provider_abstraction():
    provider = get_ocr_provider("mock")
    assert isinstance(provider, MockOCRProvider)
    result = provider.extract(b"dummy bytes", "bank_statement.pdf", "application/pdf")
    assert isinstance(result, OCRResult)
    assert len(result.pages) > 0
    assert "HDFC" in result.full_text or "Statement" in result.full_text


def test_field_extraction_confidence_scoring():
    page = OCRPageResult(
        page_number=1,
        text="Annual Revenue: 25,00,000.00\nMonthly Cash Flow: 85,000.00\nExisting Debt: 3,50,000.00\nTotal Transactions: 240",
        confidence=0.95,
        provider="native_text"
    )
    fields = extract_fields_from_pages([page], base_method="native_text")
    
    assert fields["annual_revenue"].normalized_value == 2500000.0
    assert fields["annual_revenue"].confidence >= 0.90
    assert fields["monthly_cash_flow"].normalized_value == 85000.0
    assert fields["existing_debt"].normalized_value == 350000.0
    assert fields["digital_transactions"].normalized_value == 240.0


def test_complete_document_intelligence_workflow(client: TestClient, test_user_headers: dict):
    # 1. Upload a simulated Bank Statement PDF
    pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF"
    files = {"file": ("hdfc_bank_statement.pdf", io.BytesIO(pdf_content), "application/pdf")}
    
    upload_res = client.post("/api/documents/upload", files=files, headers=test_user_headers)
    assert upload_res.status_code == 201
    doc = upload_res.json()
    doc_id = doc["id"]
    assert doc["document_type"] == "BANK_STATEMENT"
    assert doc["processing_status"] in ["REVIEW_REQUIRED", "EXTRACTED"]
    assert doc["field_count"] > 0

    # 2. Check status endpoint
    status_res = client.get(f"/api/documents/{doc_id}/status", headers=test_user_headers)
    assert status_res.status_code == 200
    st = status_res.json()
    assert st["document_type"] == "BANK_STATEMENT"
    assert st["processing_status"] in ["REVIEW_REQUIRED", "EXTRACTED"]

    # 3. Check extraction details endpoint
    ext_res = client.get(f"/api/documents/{doc_id}/extraction", headers=test_user_headers)
    assert ext_res.status_code == 200
    details = ext_res.json()
    assert len(details["fields"]) > 0
    assert details["confidence_level"] in ["High", "Medium"]
    
    # Locate annual_revenue field
    rev_field = next((f for f in details["fields"] if f["field_name"] == "annual_revenue"), None)
    assert rev_field is not None
    assert rev_field["is_verified"] is False
    assert rev_field["normalized_value"] is not None

    # 4. Check assessment prefill before verification -> should fail or indicate missing verification
    use_res = client.post(f"/api/documents/{doc_id}/use-in-assessment", headers=test_user_headers)
    assert use_res.status_code == 200
    use_data = use_res.json()
    assert use_data["is_fully_verified"] is False
    assert use_data["can_use_in_assessment"] is False

    # 5. Manual field edit
    patch_res = client.patch(
        f"/api/documents/{doc_id}/fields/{rev_field['id']}",
        json={"value": "35,00,000.00"},
        headers=test_user_headers
    )
    assert patch_res.status_code == 200
    edited_field = patch_res.json()
    assert edited_field["is_manually_edited"] is True
    assert edited_field["is_verified"] is True
    assert edited_field["normalized_value"] == 3500000.0
    assert edited_field["raw_value"] is not None  # Preserves raw original snippet!

    # 6. Verify all fields
    verify_res = client.post(f"/api/documents/{doc_id}/verify", headers=test_user_headers)
    assert verify_res.status_code == 200
    assert verify_res.json()["processing_status"] == "VERIFIED"

    # 7. Check assessment integration now that fields are verified
    use_res2 = client.post(f"/api/documents/{doc_id}/use-in-assessment", headers=test_user_headers)
    assert use_res2.status_code == 200
    use_data2 = use_res2.json()
    assert use_data2["is_fully_verified"] is True
    assert use_data2["can_use_in_assessment"] is True
    assert use_data2["assessment_input"]["annual_revenue"] == 3500000.0

    # 8. Clean up
    del_res = client.delete(f"/api/documents/{doc_id}", headers=test_user_headers)
    assert del_res.status_code == 204


def test_document_rbac_and_isolation(client: TestClient, auth_headers_user1: dict, auth_headers_user2: dict, db_session):
    # Setup User 1 as 'user' role
    user1 = db_session.query(models.User).filter(models.User.uid == "user_alpha_1").first()
    if not user1:
        user1 = models.User(uid="user_alpha_1", email="alpha@msme.com", role="user")
        db_session.add(user1)
    else:
        user1.role = "user"

    # Setup User 2 as 'analyst' role
    user2 = db_session.query(models.User).filter(models.User.uid == "user_beta_2").first()
    if not user2:
        user2 = models.User(uid="user_beta_2", email="analyst@msme.com", role="analyst")
        db_session.add(user2)
    else:
        user2.role = "analyst"
    db_session.commit()

    # User 1 uploads document
    files = {"file": ("private_tax_invoice.pdf", io.BytesIO(b"%PDF-1.4 sample"), "application/pdf")}
    res = client.post("/api/documents/upload", files=files, headers=auth_headers_user1)
    assert res.status_code == 201
    doc_id = res.json()["id"]

    # Other tenant headers (different UID with user role)
    other_user_headers = {"Authorization": "Bearer test_token:other_user_99:other@msme.com:Other"}
    
    # Other user CANNOT read or edit User 1's document
    get_res = client.get(f"/api/documents/{doc_id}", headers=other_user_headers)
    assert get_res.status_code in [403, 404]

    edit_res = client.patch(f"/api/documents/{doc_id}/type", json={"document_type": "INVOICE"}, headers=other_user_headers)
    assert edit_res.status_code in [403, 404]

    del_res = client.delete(f"/api/documents/{doc_id}", headers=other_user_headers)
    assert del_res.status_code in [403, 404]

    # Analyst CAN inspect document for risk review
    analyst_get = client.get(f"/api/documents/{doc_id}", headers=auth_headers_user2)
    assert analyst_get.status_code == 200

    # Clean up by owner
    client.delete(f"/api/documents/{doc_id}", headers=auth_headers_user1)


def test_oversized_and_invalid_file_handling(client: TestClient, test_user_headers: dict):
    # 1. Invalid extension
    bad_file = {"file": ("script.sh", io.BytesIO(b"echo 'hi'"), "application/x-sh")}
    res1 = client.post("/api/documents/upload", files=bad_file, headers=test_user_headers)
    assert res1.status_code == 400

    # 2. Empty file
    empty_file = {"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")}
    res2 = client.post("/api/documents/upload", files=empty_file, headers=test_user_headers)
    assert res2.status_code == 400

    # 3. Oversized file (>10MB)
    big_bytes = b"0" * (10 * 1024 * 1024 + 1024)
    big_file = {"file": ("large.pdf", io.BytesIO(big_bytes), "application/pdf")}
    res3 = client.post("/api/documents/upload", files=big_file, headers=test_user_headers)
    assert res3.status_code == 400
    assert "exceeds" in res3.json()["detail"].lower()
