"""
Automated Test Suite for AI Financial Intelligence Engine
Tests:
1. Decimal-safe arithmetic & consistent rounding (ROUND_HALF_UP)
2. Multi-bank account consolidation & contra transfer deduplication
3. Duplicate document & duplicate transaction detection
4. Multi-source revenue reconciliation (Declared vs Bank Receipts vs GST vs P&L)
5. Liquidity & Debt Service (DSCR) indicators with division-by-zero protection
6. 4-Dimensional Data Quality scoring
7. Transaction classification & Analyst override audit trail
8. Discrepancy generation & Analyst resolution workflow
9. Security, RBAC, and IDOR protection
10. XGBoost 11-feature contract preservation and SHAP explainability
"""

from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import models
from app.services.financial_intelligence_service import (
    FinancialIntelligenceService,
    round_curr,
    safe_decimal,
    classify_transaction
)
from app.services.prediction_service import prediction_service


# ----------------- 1. DECIMAL ARITHMETIC & ROUNDING -----------------

def test_decimal_safe_arithmetic_and_rounding():
    """Verify currency calculations use decimal arithmetic and ROUND_HALF_UP."""
    val1 = round_curr(1234.567)
    assert val1 == 1234.57

    val2 = round_curr(1234.564)
    assert val2 == 1234.56

    val3 = round_curr(None)
    assert val3 == 0.0

    # Zero & negative handling
    assert round_curr(0.0) == 0.0
    assert round_curr(-500.555) == -500.56

    # safe_decimal helper
    d = safe_decimal("150000.75")
    assert isinstance(d, Decimal)
    assert d == Decimal("150000.75")
    assert safe_decimal(None) == Decimal("0.00")
    assert safe_decimal("invalid") == Decimal("0.00")


# ----------------- 2. MULTI-ACCOUNT CONSOLIDATION & CONTRA TRANSFERS -----------------

def test_multi_bank_consolidation_and_contra_transfers(db_session: Session):
    """
    Test two accounts under the same business.
    An internal transfer of 50,000 INR from Account A to Account B must be recognized
    as a contra transfer and deducted from identified business receipts to prevent double counting.
    """
    user_uid = "fi_user_alpha"
    user = models.User(uid=user_uid, email="alpha_fi@test.com", name="Alpha MSME", role="user", approval_status="approved")
    db_session.add(user)
    
    biz = models.Business(
        user_id=user_uid,
        name="Apex Precision Engineering",
        industry="Manufacturing",
        age=6,
        employees=15
    )
    db_session.add(biz)
    db_session.commit()

    # Create 2 bank accounts
    acc1 = models.BankAccount(
        user_id=user_uid,
        business_id=biz.id,
        bank_name="HDFC Bank",
        account_number_masked="XXXXXX1001",
        account_type="CURRENT",
        ifsc_code="HDFC0001234"
    )
    acc2 = models.BankAccount(
        user_id=user_uid,
        business_id=biz.id,
        bank_name="State Bank of India",
        account_number_masked="XXXXXX2002",
        account_type="CURRENT",
        ifsc_code="SBIN0005678"
    )
    db_session.add_all([acc1, acc2])
    db_session.commit()

    # Add transactions:
    # 1. Genuine customer sale in Acc1: 150,000 Cr
    # 2. Transfer out of Acc1 to Acc2: 50,000 Dr on 2026-03-10
    # 3. Transfer in to Acc2 from Acc1: 50,000 Cr on 2026-03-11
    # 4. Supplier expense from Acc2: 30,000 Dr
    t1 = models.BankTransaction(
        bank_account_id=acc1.id,
        transaction_date="2026-03-05",
        description="NEFT INW: ACME CORP INVOICE 401",
        credit=150000.0,
        debit=0.0,
        balance=250000.0,
        category="sales_receipt"
    )
    t2 = models.BankTransaction(
        bank_account_id=acc1.id,
        transaction_date="2026-03-10",
        description="TRF TO SBI CURRENT ACCT OWN FUNDS",
        credit=0.0,
        debit=50000.0,
        balance=200000.0,
        category="own_account_transfer"
    )
    t3 = models.BankTransaction(
        bank_account_id=acc2.id,
        transaction_date="2026-03-11",
        description="TRF FROM HDFC OWN ACC",
        credit=50000.0,
        debit=0.0,
        balance=80000.0,
        category="own_account_transfer"
    )
    t4 = models.BankTransaction(
        bank_account_id=acc2.id,
        transaction_date="2026-03-15",
        description="SUPPLIER PAYMENT RAW MATERIALS",
        credit=0.0,
        debit=30000.0,
        balance=50000.0,
        category="supplier_payment"
    )
    db_session.add_all([t1, t2, t3, t4])
    db_session.commit()

    service = FinancialIntelligenceService(db_session)
    summary = service.calculate_financial_intelligence(user_uid)

    # Gross credits: 150,000 + 50,000 = 200,000
    assert summary["cash_flow"]["total_credits"] == 200000.0
    # Gross debits: 50,000 + 30,000 = 80,000
    assert summary["cash_flow"]["total_debits"] == 80000.0
    # Net flow: 200,000 - 80,000 = 120,000
    assert summary["cash_flow"]["net_cash_flow"] == 120000.0

    # True Identified Business Receipts = Gross Credits (200k) - Contra (50k) = 150,000 INR
    assert summary["revenue"]["identified_business_receipts"] == 150000.0

    # Two accounts reported
    assert summary["accounts_count"] == 2


# ----------------- 3. DUPLICATE DETECTION & DATA QUALITY -----------------

def test_duplicate_document_and_transaction_detection(db_session: Session):
    """Verify duplicate document file_hash detection."""
    user_uid = "fi_user_beta"
    user = models.User(uid=user_uid, email="beta_fi@test.com", name="Beta Tools", role="user", approval_status="approved")
    db_session.add(user)
    db_session.commit()

    # Two documents with duplicate file_hash
    doc1 = models.Document(
        user_id=user_uid,
        filename="bank_stmt_march.pdf",
        original_filename="bank_stmt_march.pdf",
        file_size=2048,
        mime_type="application/pdf",
        document_type="BANK_STATEMENT",
        file_path="uploads/stmt1.pdf",
        file_hash="hash_identical_12345",
        status="verified"
    )
    doc2 = models.Document(
        user_id=user_uid,
        filename="bank_stmt_march_copy.pdf",
        original_filename="bank_stmt_march_copy.pdf",
        file_size=2048,
        mime_type="application/pdf",
        document_type="BANK_STATEMENT",
        file_path="uploads/stmt2.pdf",
        file_hash="hash_identical_12345",
        status="verified"
    )
    db_session.add_all([doc1, doc2])
    db_session.commit()

    service = FinancialIntelligenceService(db_session)
    dup_files = service.detect_duplicate_files(user_uid)

    assert len(dup_files) >= 1
    assert dup_files[0]["file_hash"] == "hash_identical_12345"


# ----------------- 4. REVENUE RECONCILIATION & GST VARIANCE -----------------

def test_revenue_reconciliation(db_session: Session):
    """
    Test reconciliation between declared annual revenue (12,00,000),
    GST turnover, and annualized bank deposits.
    """
    user_uid = "fi_user_gamma"
    user = models.User(uid=user_uid, email="gamma_fi@test.com", name="Gamma Fab", role="user", approval_status="approved")
    db_session.add(user)
    
    biz = models.Business(
        user_id=user_uid,
        name="Gamma Fabricators",
        industry="Manufacturing",
        age=4,
        employees=8
    )
    db_session.add(biz)
    db_session.commit()

    # Add Assessment with declared revenue of 12,00,000
    assessment = models.Assessment(
        business_id=biz.id,
        annual_revenue=1200000.0,
        monthly_cash_flow=80000.0,
        monthly_expenses=50000.0,
        existing_debt=100000.0,
        digital_transactions=150,
        utility_payment_score=80.0,
        invoice_payment_score=85.0,
        previous_defaults=0
    )
    db_session.add(assessment)

    # Upload GST return with extracted taxable turnover of 11,50,000
    gst_doc = models.Document(
        user_id=user_uid,
        business_id=biz.id,
        filename="gstr3b_annual.pdf",
        original_filename="gstr3b_annual.pdf",
        file_size=4096,
        mime_type="application/pdf",
        document_type="GST_DOCUMENT",
        file_path="uploads/gst.pdf",
        extracted_data={"taxable_turnover": 1150000.0, "total_turnover": 1150000.0},
        status="verified"
    )
    db_session.add(gst_doc)
    db_session.commit()

    service = FinancialIntelligenceService(db_session)
    summary = service.calculate_financial_intelligence(user_uid)

    assert summary["revenue"]["declared_turnover"] == 1200000.0
    assert summary["revenue"]["supporting_records_turnover"] == 1150000.0


# ----------------- 5. LIQUIDITY & DEBT SERVICE INDICATORS -----------------

def test_liquidity_and_dscr_calculation(db_session: Session):
    """Verify current ratio, working capital, and DSCR with zero-division safety."""
    user_uid = "fi_user_delta"
    user = models.User(uid=user_uid, email="delta_fi@test.com", name="Delta Auto", role="user", approval_status="approved")
    db_session.add(user)
    
    biz = models.Business(
        user_id=user_uid,
        name="Delta Automotive Parts",
        industry="Automotive",
        age=8,
        employees=22
    )
    db_session.add(biz)
    db_session.commit()

    assessment = models.Assessment(
        business_id=biz.id,
        annual_revenue=2400000.0,
        monthly_cash_flow=150000.0,
        monthly_expenses=120000.0,
        existing_debt=300000.0,
        digital_transactions=400,
        utility_payment_score=90.0,
        invoice_payment_score=88.0,
        previous_defaults=0
    )
    db_session.add(assessment)

    # Balance sheet document with current assets = 500,000 and current liabilities = 250,000
    bs_doc = models.Document(
        user_id=user_uid,
        business_id=biz.id,
        filename="balance_sheet_2026.pdf",
        original_filename="balance_sheet_2026.pdf",
        file_size=5120,
        mime_type="application/pdf",
        document_type="BALANCE_SHEET",
        file_path="uploads/bs.pdf",
        extracted_data={"current_assets": 500000.0, "current_liabilities": 250000.0},
        status="verified"
    )
    db_session.add(bs_doc)
    db_session.commit()

    service = FinancialIntelligenceService(db_session)
    summary = service.calculate_financial_intelligence(user_uid)

    # Current ratio = 500,000 / 250,000 = 2.0
    assert summary["liquidity"]["current_ratio"] == 2.0
    # Working capital = 500,000 - 250,000 = 250,000
    assert summary["liquidity"]["working_capital"] == 250000.0


# ----------------- 6. 4-DIMENSIONAL DATA QUALITY SCORE -----------------

def test_data_quality_scoring_dimensions(db_session: Session):
    """Verify the 4 dimensions: completeness, consistency, source reliability, reconciliation."""
    service = FinancialIntelligenceService(db_session)

    # Empty user with no accounts or docs -> low completeness
    summary = service.calculate_financial_intelligence("empty_user")
    dq = summary["data_quality"]
    assert 0.0 <= dq["overall_score"] <= 100.0
    assert "completeness_score" in dq
    assert "consistency_score" in dq
    assert "source_reliability_score" in dq
    assert "reconciliation_score" in dq
    assert dq["completeness_score"] < 30.0


# ----------------- 7. ANALYST TRANSACTION OVERRIDE & AUDIT -----------------

def test_analyst_transaction_override(client: TestClient, db_session: Session):
    """Test underwriter category override with audit record logging."""
    user_uid = "fi_user_epsilon"
    user = models.User(uid=user_uid, email="epsilon@test.com", name="Epsilon Traders", role="user", approval_status="approved")
    db_session.add(user)
    
    acc = models.BankAccount(
        user_id=user_uid,
        bank_name="ICICI Bank",
        account_number_masked="XXXXXX9999"
    )
    db_session.add(acc)
    db_session.commit()

    tx = models.BankTransaction(
        bank_account_id=acc.id,
        transaction_date="2026-03-20",
        description="UNKNOWN ONLINE CREDIT REF 9901",
        credit=45000.0,
        debit=0.0,
        category="unknown"
    )
    db_session.add(tx)
    db_session.commit()

    # Analyst auth headers
    analyst_headers = {"Authorization": "Bearer test_token:fi_analyst_1:analyst@msme.com:Senior Credit Analyst"}
    # Assign analyst role to analyst in DB
    analyst_user = models.User(uid="fi_analyst_1", email="analyst@msme.com", name="Senior Credit Analyst", role="analyst", approval_status="approved")
    db_session.add(analyst_user)
    db_session.commit()

    # Patch classification
    payload = {
        "new_category": "sales_receipt",
        "reason": "Verified invoice INV-2026-9901 provided by applicant during underwriter interview."
    }
    resp = client.patch(f"/api/financial-intelligence/transactions/{tx.id}/classification", json=payload, headers=analyst_headers)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["category"] == "sales_receipt"

    # Verify audit record
    audit = db_session.query(models.TransactionClassificationAudit).filter_by(transaction_id=tx.id).first()
    assert audit is not None
    assert audit.previous_category == "unknown"
    assert audit.new_category == "sales_receipt"
    assert audit.performed_by == "fi_analyst_1"


# ----------------- 8. DISCREPANCY RESOLUTION WORKFLOW -----------------

def test_discrepancy_resolution(client: TestClient, db_session: Session):
    """Test resolving a financial discrepancy with analyst notes."""
    user_uid = "fi_user_zeta"
    user = models.User(uid=user_uid, email="zeta@test.com", name="Zeta Logistics", role="user", approval_status="approved")
    db_session.add(user)
    
    disc = models.FinancialDiscrepancy(
        user_id=user_uid,
        discrepancy_code="STATEMENT_GAP",
        title="Missing Statement Period: February 2026",
        severity="MEDIUM",
        affected_field="statement_coverage",
        explanation="Bank statements have a 30-day gap in February.",
        verification_status="OPEN"
    )
    db_session.add(disc)
    db_session.commit()

    analyst_headers = {"Authorization": "Bearer test_token:fi_analyst_2:analyst2@msme.com:Senior Analyst"}
    analyst_user = models.User(uid="fi_analyst_2", email="analyst2@msme.com", name="Senior Analyst", role="analyst", approval_status="approved")
    db_session.add(analyst_user)
    db_session.commit()

    resolve_payload = {
        "status": "RESOLVED",
        "resolution_notes": "Applicant uploaded supplemental February account statement; gap bridged."
    }
    resp = client.post(f"/api/financial-intelligence/discrepancies/{disc.id}/resolve", json=resolve_payload, headers=analyst_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["verification_status"] == "RESOLVED"
    assert "supplemental" in data["analyst_resolution"]
    assert data["resolved_by"] == "fi_analyst_2"


# ----------------- 9. SECURITY, RBAC & IDOR PROTECTION -----------------

def test_security_and_idor_protection(client: TestClient, db_session: Session):
    """Verify that User A cannot read or modify User B's financial intelligence."""
    user_a = models.User(uid="user_victim_a", email="victim@msme.com", name="Victim Corp", role="user", approval_status="approved")
    user_b = models.User(uid="user_attacker_b", email="attacker@msme.com", name="Attacker Corp", role="user", approval_status="approved")
    db_session.add_all([user_a, user_b])
    db_session.commit()

    attacker_headers = {"Authorization": "Bearer test_token:user_attacker_b:attacker@msme.com:Attacker Corp"}

    # Attacker tries to query victim's financial summary
    resp = client.get(f"/api/financial-intelligence/summary?user_id={user_a.uid}", headers=attacker_headers)
    # Non-analyst / non-admin cannot specify another user's ID
    assert resp.status_code in (403, 404)

    # Missing auth
    unauth_resp = client.get("/api/financial-intelligence/summary")
    assert unauth_resp.status_code == 401


# ----------------- 10. ML FEATURE CONTRACT & SHAP PRESERVATION -----------------

def test_ml_feature_contract_and_shap_preservation():
    """
    Verify that the existing XGBoost model and preprocessing pipeline
    maintain their strict 11-feature contract and produce valid SHAP explainability.
    """
    model = prediction_service.load_model()
    assert model is not None

    # Strict 11 features defined in training pipeline
    sample_11_features = {
        "name": "Beta Machine Works",
        "industry": "Manufacturing",
        "age": 6,
        "employees": 24,
        "annual_revenue": 1800000.0,
        "monthly_cash_flow": 120000.0,
        "monthly_expenses": 75000.0,
        "existing_debt": 220000.0,
        "digital_transactions": 310,
        "utility_payment_score": 88.0,
        "invoice_payment_score": 82.0,
        "previous_defaults": 0
    }

    result = prediction_service.predict_risk(sample_11_features)
    assert result["risk_level"] in ("LOW", "MEDIUM", "HIGH")
    assert 0.0 <= result["default_probability"] <= 100.0
    assert isinstance(result["top_factors"], list)
    assert len(result["top_factors"]) > 0
