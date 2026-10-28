"""
Automated test suite for Identity Verification and Multi-Bank Analysis:
- Valid and invalid PAN formats and entity type mapping.
- Masked Aadhaar and mandatory informed consent.
- External verification unconfigured returns UNABLE_TO_VERIFY.
- Multiple bank accounts registration and isolation.
- Internal transfer (contra) detection across applicant's accounts.
- Credit classification (sales receipt vs contra vs loan proceeds vs unknown).
- Debt obligation / loan EMI detection from bank debits.
- Consolidated multi-bank financial view with revenue reconciliation.
- Applicant correction and resubmission audit trail.
- IDOR tenant isolation and RBAC security.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import models
from app.services.identity_service import (
    validate_pan_format,
    validate_aadhaar_format,
    mask_pan,
    mask_aadhaar,
    IdentityVerificationEngine
)
from app.services.bank_analysis_service import (
    BankAnalysisService,
    classify_credit_transaction,
    classify_debit_transaction
)
from app.services.correction_service import CorrectionService


# ----------------- 1. PAN & AADHAAR FORMAT VALIDATION & MASKING -----------------

def test_pan_format_validation():
    # Valid individual PAN (4th char 'P')
    valid, entity_type, code, msg = validate_pan_format("ABCPE1234F")
    assert valid is True
    assert entity_type == "INDIVIDUAL"
    assert code == "P"

    # Valid company PAN (4th char 'C')
    valid, entity_type, code, msg = validate_pan_format("AAACC1234G")
    assert valid is True
    assert entity_type == "COMPANY"
    assert code == "C"

    # Valid firm / partnership PAN (4th char 'F')
    valid, entity_type, code, msg = validate_pan_format("BLAFP9999K")
    assert valid is True
    assert entity_type == "PARTNERSHIP_FIRM_OR_LLP"

    # Invalid: 4th char is invalid entity code 'Z'
    valid, entity_type, code, msg = validate_pan_format("ABCZE1234F")
    assert valid is False
    assert "Invalid 4th character" in msg

    # Invalid: Length not 10
    valid, entity_type, code, msg = validate_pan_format("ABC1234")
    assert valid is False
    assert "Invalid length" in msg

    # Invalid: Digits in alpha section
    valid, entity_type, code, msg = validate_pan_format("12345ABCDE")
    assert valid is False

def test_pan_masking():
    assert mask_pan("ABCPE1234F") == "ABCPE****F"
    assert mask_pan("") == ""
    assert mask_pan("AAACC9876M") == "AAACC****M"

def test_aadhaar_format_validation():
    # Valid 12-digit Aadhaar starting with 2-9
    valid, msg = validate_aadhaar_format("234567890123")
    assert valid is True

    # Valid with spaces / hyphens
    valid, msg = validate_aadhaar_format("2345-6789-0123")
    assert valid is True

    # Invalid: starts with 0 or 1
    valid, msg = validate_aadhaar_format("012345678901")
    assert valid is False
    assert "cannot start with digit '0' or '1'" in msg

    # Invalid length (11 digits)
    valid, msg = validate_aadhaar_format("23456789012")
    assert valid is False
    assert "must be exactly 12 digits" in msg

    # Invalid non-numeric
    valid, msg = validate_aadhaar_format("23456789012A")
    assert valid is False

def test_aadhaar_masking_preserves_only_last_4():
    assert mask_aadhaar("234567890123") == "XXXX-XXXX-0123"
    assert mask_aadhaar("2345-6789-0123") == "XXXX-XXXX-0123"
    assert mask_aadhaar("") == ""


# ----------------- 2. IDENTITY SERVICE & MANDATORY CONSENT -----------------

def test_aadhaar_verification_requires_consent(db_session: Session):
    engine = IdentityVerificationEngine(db_session)
    with pytest.raises(ValueError, match="consent is mandatory"):
        engine.verify_aadhaar_document(
            user_id="user_alpha_1",
            business_id=None,
            document_id=None,
            extracted_aadhaar_raw="234567890123",
            consent_obtained=False
        )

def test_external_verification_never_fabricates_when_unconfigured(db_session: Session):
    engine = IdentityVerificationEngine(db_session)
    pan_record = engine.verify_pan_document(
        user_id="user_alpha_1",
        business_id=None,
        document_id=None,
        extracted_pan="ABCPE1234F",
        extracted_name="Test Enterprise"
    )
    # Format valid is TRUE, but external verification status MUST be UNABLE_TO_VERIFY
    assert pan_record.format_valid is True
    assert pan_record.external_verification_status == "UNABLE_TO_VERIFY"
    assert "Unable to Verify Externally" in pan_record.external_verification_message


# ----------------- 3. MULTI-BANK STATEMENT PROCESSING & CONTRA TRANSFERS -----------------

def test_credit_classification():
    # Sales receipts
    cat, conf = classify_credit_transaction("UPI/34928190/MERCHANT SETTLEMENT/RAZORPAY")
    assert cat == "sales_receipt"

    # Contra transfer
    cat, conf = classify_credit_transaction("NEFT TRF TO OWN A/C 918230")
    assert cat == "own_account_transfer"

    # Loan proceed
    cat, conf = classify_credit_transaction("WORKING CAPITAL DISBURSEMENT TATA CAPITAL")
    assert cat == "loan_proceeds"

    # Refund
    cat, conf = classify_credit_transaction("GST REFUND 2024-25 REVERSAL")
    assert cat == "refund"

    # Capital injection
    cat, conf = classify_credit_transaction("DIRECTOR LOAN SHARE CAPITAL CONTRIBUTION")
    assert cat == "capital_injection"

    # Uncertain transaction must NOT invent category
    cat, conf = classify_credit_transaction("CHQ TRANSFER MISC 00921")
    assert cat == "unknown"

def test_debit_classification_and_emi():
    cat, conf = classify_debit_transaction("ACH DEBIT BAJAJ FINANCE LOAN EMI")
    assert cat == "loan_repayment_emi"

    cat, conf = classify_debit_transaction("OFFICE RENT ELECTRICITY OPERATING EXP")
    assert cat == "operating_expense"

def test_multi_bank_registration_and_internal_transfer_detection(db_session: Session):
    # Ensure user exists
    user = db_session.query(models.User).filter(models.User.uid == "user_alpha_1").first()
    if not user:
        user = models.User(uid="user_alpha_1", email="alpha@msme.com", name="Alpha User")
        db_session.add(user)
        db_session.commit()

    service = BankAnalysisService(db_session)

    # 1. Register two accounts for same applicant
    acc1 = service.register_bank_account(
        user_id="user_alpha_1",
        business_id=None,
        bank_name="HDFC Bank",
        account_number="501002345678",
        account_type="CURRENT",
        is_primary=True
    )
    assert acc1.account_number_masked == "XXXXXX5678"

    acc2 = service.register_bank_account(
        user_id="user_alpha_1",
        business_id=None,
        bank_name="State Bank of India",
        account_number="309812349999",
        account_type="CURRENT",
        is_primary=False
    )
    assert acc2.account_number_masked == "XXXXXX9999"

    # 2. Upload statement to HDFC with ₹50,000 debit
    txs_hdfc = [
        {"date": "2024-04-10", "description": "CUSTOMER POS RECEIPT", "credit": 120000.0, "debit": 0.0, "balance": 120000.0},
        {"date": "2024-04-15", "description": "TRANSFER TO SBI A/C 9999", "credit": 0.0, "debit": 50000.0, "balance": 70000.0},
        {"date": "2024-04-20", "description": "HDFC LOAN EMI REPAYMENT", "credit": 0.0, "debit": 15000.0, "balance": 55000.0},
    ]
    summary1 = service.process_statement_transactions(
        bank_account_id=acc1.id,
        document_id=1,
        transactions_data=txs_hdfc,
        opening_balance=0.0,
        closing_balance=55000.0,
        period_start="2024-04-01",
        period_end="2024-04-30"
    )
    assert summary1["arithmetic_consistent"] is True

    # 3. Upload statement to SBI with matching ₹50,000 credit on 2024-04-15
    txs_sbi = [
        {"date": "2024-04-15", "description": "FUNDS TRANSFER FROM HDFC 5678", "credit": 50000.0, "debit": 0.0, "balance": 50000.0},
        {"date": "2024-04-25", "description": "VENDOR PAYROLL", "credit": 0.0, "debit": 20000.0, "balance": 30000.0},
    ]
    summary2 = service.process_statement_transactions(
        bank_account_id=acc2.id,
        document_id=2,
        transactions_data=txs_sbi,
        opening_balance=0.0,
        closing_balance=30000.0,
        period_start="2024-04-01",
        period_end="2024-04-30"
    )
    assert summary2["arithmetic_consistent"] is True

    # 4. Generate consolidated analysis
    consolidated = service.generate_consolidated_analysis(user_id="user_alpha_1")
    assert consolidated["has_sufficient_data"] is True
    assert consolidated["accounts_count"] == 2

    metrics = consolidated["metrics"]
    # Total gross credits = 120,000 + 50,000 = 170,000
    assert metrics["total_credits"] == 170000.0

    # Internal transfer detected and deducted = 50,000
    assert metrics["internal_transfers_deducted"] == 50000.0

    # True estimated business receipts = 170,000 - 50,000 = 120,000 (NOT 170,000!)
    assert metrics["estimated_business_receipts"] == 120000.0

    # EMI observed = 15,000
    assert metrics["observed_loan_repayments_total"] == 15000.0


# ----------------- 4. APPLICANT CORRECTIONS & AUDIT -----------------

def test_applicant_correction_lifecycle(db_session: Session):
    # Ensure user exists
    user = db_session.query(models.User).filter(models.User.uid == "user_alpha_1").first()
    if not user:
        user = models.User(uid="user_alpha_1", email="alpha@msme.com", name="Alpha User")
        db_session.add(user)
        db_session.commit()

    bus = models.Business(
        user_id="user_alpha_1",
        name="Apex Industrial Works",
        industry="Manufacturing",
        age=5,
        employees=15
    )
    db_session.add(bus)
    db_session.commit()
    db_session.refresh(bus)

    service = CorrectionService(db_session)
    corr = service.submit_correction(
        user_id="user_alpha_1",
        business_id=bus.id,
        field_name="annual_revenue",
        original_value="1200000",
        corrected_value="1500000",
        reason="Updated to match final audited GSTR-9 annual return"
    )
    assert corr.status == "PENDING_REVIEW"
    assert corr.corrected_value == "1500000"

    # Underwriter reviews and accepts
    reviewed = service.review_correction(
        correction_id=corr.id,
        analyst_uid="analyst_test_01",
        decision="ACCEPTED",
        notes="GSTR-9 reconciled. Approved correction."
    )
    assert reviewed.status == "ACCEPTED"
    assert reviewed.recalculated_at is not None


# ----------------- 5. API ENDPOINTS & TENANT ISOLATION (IDOR) -----------------

def test_identity_api_pan_and_status(client: TestClient, auth_headers_user1: dict):
    # 1. Submit PAN verification via API
    resp = client.post(
        "/api/identity/verify-pan",
        headers=auth_headers_user1,
        json={
            "pan_number": "ABCPE1234F",
            "name_on_pan": "Alpha Risk Officer",
            "dob_or_incorporation": "1990-05-15"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["masked_id"] == "ABCPE****F"
    assert data["format_valid"] is True
    assert data["external_verification_status"] == "UNABLE_TO_VERIFY"

    # 2. Get status via API
    status_resp = client.get("/api/identity/status", headers=auth_headers_user1)
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["pan_verification"] is not None
    assert status_data["requires_manual_review"] is True

def test_identity_api_aadhaar_requires_consent(client: TestClient, auth_headers_user1: dict):
    resp = client.post(
        "/api/identity/verify-aadhaar",
        headers=auth_headers_user1,
        json={
            "aadhaar_number": "234567890123",
            "consent_obtained": False
        }
    )
    assert resp.status_code == 400
    assert "consent is legally mandatory" in resp.json()["detail"]

def test_multi_bank_api_flow_and_isolation(client: TestClient, auth_headers_user1: dict, auth_headers_user2: dict):
    # 1. Register bank account
    create_resp = client.post(
        "/api/bank-accounts",
        headers=auth_headers_user1,
        json={
            "bank_name": "Kotak Mahindra Bank",
            "account_number": "1298456701",
            "account_type": "CURRENT",
            "is_primary": True
        }
    )
    assert create_resp.status_code == 201
    acc_id = create_resp.json()["id"]
    assert create_resp.json()["account_number_masked"] == "XXXXXX6701"

    # 2. Other user cannot access this bank account (IDOR)
    other_resp = client.get(f"/api/bank-accounts/{acc_id}", headers=auth_headers_user2)
    assert other_resp.status_code == 403

    # 3. Owner can access
    owner_resp = client.get(f"/api/bank-accounts/{acc_id}", headers=auth_headers_user1)
    assert owner_resp.status_code == 200

    # 4. Upload statement transactions
    upload_tx_resp = client.post(
        f"/api/bank-accounts/{acc_id}/upload-statement",
        headers=auth_headers_user1,
        json={
            "transactions": [
                {"date": "2024-05-01", "description": "POS MERCHANT UPI", "credit": 80000.0, "debit": 0.0, "balance": 80000.0},
                {"date": "2024-05-10", "description": "OFFICE EXPENSE", "credit": 0.0, "debit": 30000.0, "balance": 50000.0}
            ],
            "opening_balance": 0.0,
            "closing_balance": 50000.0,
            "period_start": "2024-05-01",
            "period_end": "2024-05-31"
        }
    )
    assert upload_tx_resp.status_code == 200
    assert upload_tx_resp.json()["summary"]["total_credits"] == 80000.0

    # 5. Get consolidated analysis via API
    cons_resp = client.get("/api/bank-accounts/consolidated-analysis", headers=auth_headers_user1)
    assert cons_resp.status_code == 200
    assert cons_resp.json()["has_sufficient_data"] is True
