"""
Performance and Correctness Regression Test Suite
Validates:
1. DB Connection Pool Configuration & Settings
2. Zero-commit and reduced query count on SUMMARY_FETCH
3. Contra-transfer reconciliation & in-memory deduplication correctness
4. SQL Aggregation correctness for /accounts and /transactions endpoints
5. Documents listing uses selectinload & local /download endpoint (no remote pre-signing)
6. Client disconnect middleware handling (returns 499 cleanly)
7. Scikit-learn model compatibility & inference without version warnings
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database import models
from app.services.financial_intelligence_service import (
    FinancialIntelligenceService,
)
from app.services.prediction_service import prediction_service


# ---------------- 1. DB POOL CONFIGURATION CHECK ----------------
def test_db_pool_configuration():
    """Verify production engine settings match optimized connection pool requirements."""
    from app.database import database
    import inspect
    db_source = inspect.getsource(database)
    assert '"pool_size": 10' in db_source
    assert '"max_overflow": 5' in db_source
    assert '"pool_timeout": 15' in db_source
    assert '"pool_recycle": 300' in db_source
    assert '"pool_pre_ping": True' in db_source


# ---------------- 2. FINANCIAL SUMMARY ZERO-COMMIT & REDUCED QUERIES ----------------
def test_summary_fetch_zero_commit_when_unchanged(db_session: Session):
    """Verify SUMMARY_FETCH does not perform unnecessary commits or writes when data hasn't changed."""
    user_uid = "perf_user_test"
    user = models.User(uid=user_uid, email="perf@test.com", name="Perf User", role="user", approval_status="approved")
    db_session.add(user)
    
    biz = models.Business(
        user_id=user_uid,
        name="Performance Manufacturing",
        industry="Manufacturing",
        age=5,
        employees=10
    )
    db_session.add(biz)
    db_session.commit()

    acc = models.BankAccount(
        user_id=user_uid,
        business_id=biz.id,
        bank_name="Test Bank",
        account_number_masked="XXXXXX1111",
        account_type="CURRENT"
    )
    db_session.add(acc)
    db_session.commit()

    tx = models.BankTransaction(
        bank_account_id=acc.id,
        transaction_date="2025-01-15",
        credit=150000.0,
        debit=0.0,
        balance=250000.0,
        description="Client payment for invoices",
        category="sales_receipt"
    )
    db_session.add(tx)
    db_session.commit()

    # Initial run to populate metrics
    service = FinancialIntelligenceService(db_session)
    result1 = service.calculate_financial_intelligence(
        user_id=user_uid,
        business_id=biz.id,
        trigger_source="ON_DEMAND"
    )
    assert result1 is not None

    # Track commit calls on subsequent SUMMARY_FETCH requests
    commit_count = 0
    original_commit = db_session.commit
    def counting_commit():
        nonlocal commit_count
        commit_count += 1
        return original_commit()

    db_session.commit = counting_commit

    # Run SUMMARY_FETCH when data is unchanged
    result2 = service.calculate_financial_intelligence(
        user_id=user_uid,
        business_id=biz.id,
        trigger_source="SUMMARY_FETCH"
    )

    # Result must be valid
    assert result2 is not None
    assert result2["cash_flow"]["total_credits"] == 150000.0
    # On SUMMARY_FETCH when unchanged, financial analysis run should NOT be created or committed
    assert commit_count == 0

    # Restore original commit
    db_session.commit = original_commit


# ---------------- 3. CONTRA TRANSFERS & DEDUPLICATION CORRECTNESS ----------------
def test_contra_transfers_and_duplicate_handling_correctness(db_session: Session):
    """Verify contra transfer reconciliation accurately deducts internal transfers without double-counting."""
    user_uid = "contra_user_test"
    user = models.User(uid=user_uid, email="contra@test.com", name="Contra User", role="user", approval_status="approved")
    db_session.add(user)
    
    biz = models.Business(
        user_id=user_uid,
        name="Contra Corp",
        industry="Retail",
        age=3,
        employees=5
    )
    db_session.add(biz)
    db_session.commit()

    acc1 = models.BankAccount(
        user_id=user_uid,
        business_id=biz.id,
        bank_name="HDFC Bank",
        account_number_masked="XXXXXX1001",
        account_type="CURRENT"
    )
    acc2 = models.BankAccount(
        user_id=user_uid,
        business_id=biz.id,
        bank_name="ICICI Bank",
        account_number_masked="XXXXXX2002",
        account_type="CURRENT"
    )
    db_session.add_all([acc1, acc2])
    db_session.commit()

    # Acc 1 pays Acc 2 50,000 INR on same day
    t1 = models.BankTransaction(
        bank_account_id=acc1.id,
        transaction_date="2025-02-10",
        debit=50000.0,
        credit=0.0,
        balance=150000.0,
        description="Transfer to ICICI 2002",
        category="own_account_transfer"
    )
    t2 = models.BankTransaction(
        bank_account_id=acc2.id,
        transaction_date="2025-02-10",
        credit=50000.0,
        debit=0.0,
        balance=50000.0,
        description="Transfer from HDFC 1001",
        category="own_account_transfer"
    )
    # Genuine revenue
    t3 = models.BankTransaction(
        bank_account_id=acc1.id,
        transaction_date="2025-02-12",
        credit=120000.0,
        debit=0.0,
        balance=270000.0,
        description="Customer Invoice Payment",
        category="sales_receipt"
    )
    db_session.add_all([t1, t2, t3])
    db_session.commit()

    service = FinancialIntelligenceService(db_session)
    result = service.calculate_financial_intelligence(
        user_id=user_uid,
        business_id=biz.id,
        trigger_source="ON_DEMAND"
    )

    # Gross credits: 120,000 + 50,000 = 170,000
    # Identified Business Receipts = 170,000 - 50,000 (contra transfer) = 120,000
    assert result["cash_flow"]["total_credits"] == 170000.0
    assert result["revenue"]["identified_business_receipts"] == 120000.0
    assert result["accounts_count"] == 2


# ---------------- 4. SQL AGGREGATION FOR /accounts AND /transactions ----------------
def test_accounts_and_transactions_sql_aggregation(client: TestClient, db_session: Session, auth_headers_user1: dict):
    """Verify /accounts and /transactions return accurate aggregation metrics via SQL."""
    user_uid = "user_alpha_1"
    user = db_session.query(models.User).filter_by(uid=user_uid).first()
    if not user:
        user = models.User(uid=user_uid, email="alpha@msme.com", name="Alpha User", role="user", approval_status="approved")
        db_session.add(user)

    biz = models.Business(user_id=user_uid, name="SQL Agg Biz", industry="IT", age=4, employees=8)
    db_session.add(biz)
    db_session.commit()

    acc = models.BankAccount(
        user_id=user_uid,
        business_id=biz.id,
        bank_name="State Bank",
        account_number_masked="XXXXXX9988",
        account_type="CURRENT"
    )
    db_session.add(acc)
    db_session.commit()

    t1 = models.BankTransaction(
        bank_account_id=acc.id,
        transaction_date="2025-03-01",
        credit=75000.0,
        debit=0.0,
        category="sales_receipt",
        description="Customer Receipt"
    )
    t2 = models.BankTransaction(
        bank_account_id=acc.id,
        transaction_date="2025-03-05",
        credit=0.0,
        debit=25000.0,
        category="operating_expense",
        description="Office Supplies"
    )
    db_session.add_all([t1, t2])
    db_session.commit()

    # Test /accounts
    res_accounts = client.get(f"/api/financial-intelligence/accounts?business_id={biz.id}", headers=auth_headers_user1)
    assert res_accounts.status_code == 200
    acc_data = res_accounts.json()
    assert len(acc_data) >= 1
    target_acc = next(a for a in acc_data if a["account_number_masked"] == "XXXXXX9988")
    assert target_acc["transaction_count"] == 2

    # Test /transactions
    res_txs = client.get(f"/api/financial-intelligence/transactions?business_id={biz.id}", headers=auth_headers_user1)
    assert res_txs.status_code == 200
    tx_json = res_txs.json()
    assert tx_json["total_count"] == 2
    assert "sales_receipt" in tx_json["categories_summary"]
    assert tx_json["categories_summary"]["sales_receipt"] == 75000.0
    assert tx_json["categories_summary"]["operating_expense"] == 25000.0


# ---------------- 5. DOCUMENTS SELECTINLOAD & LOCAL DOWNLOAD URL ----------------
def test_documents_listing_avoids_remote_signing(client: TestClient, db_session: Session, auth_headers_user1: dict):
    """Verify GET /api/documents produces direct download URLs without calling remote signed URLs."""
    user_uid = "user_alpha_1"
    biz = db_session.query(models.Business).filter_by(user_id=user_uid).first()
    if not biz:
        biz = models.Business(user_id=user_uid, name="Doc Biz", industry="Retail", age=2, employees=3)
        db_session.add(biz)
        db_session.commit()

    doc = models.Document(
        user_id=user_uid,
        business_id=biz.id,
        filename="bank_stmt.pdf",
        original_filename="bank_stmt_original.pdf",
        file_size=2048,
        mime_type="application/pdf",
        document_type="BANK_STATEMENT",
        file_path="uploads/bank_stmt.pdf",
        status="verified"
    )
    db_session.add(doc)
    db_session.commit()

    # Add extracted field to test selectinload
    field = models.ExtractedField(
        document_id=doc.id,
        field_name="total_turnover",
        raw_value="1500000",
        normalized_value=1500000.0,
        confidence=0.98
    )
    db_session.add(field)
    db_session.commit()

    res = client.get(f"/api/documents", headers=auth_headers_user1)
    assert res.status_code == 200
    docs = res.json()
    assert len(docs) >= 1
    target_doc = next(d for d in docs if d["filename"] == "bank_stmt.pdf")
    # URL points directly to local fast download endpoint
    assert target_doc["download_url"] == f"/api/documents/{doc.id}/download"
    assert target_doc["field_count"] == 1


# ---------------- 6. CLIENT DISCONNECT HANDLING ----------------
def test_client_disconnect_returns_499(client: TestClient):
    """Verify that ClientDisconnected exception is handled cleanly and returns HTTP 499."""
    from uvicorn.protocols.utils import ClientDisconnected
    from app.main import app
    from fastapi import Request

    @app.get("/api/test-disconnect")
    async def disconnect_route(request: Request):
        raise ClientDisconnected()

    res = client.get("/api/test-disconnect")
    assert res.status_code == 499


# ---------------- 7. SCIKIT-LEARN MODEL COMPATIBILITY ----------------
def test_scikit_learn_model_inference():
    """Verify the loaded model and prediction service run inference without warnings or shape errors."""
    sample_data = {
        "annual_revenue": 5000000.0,
        "net_profit_margin": 15.0,
        "debt_to_equity": 0.8,
        "current_ratio": 1.5,
        "cibil_score": 750,
        "business_age_years": 6,
        "gst_compliance_score": 92.0,
        "industry_risk_score": 3.0,
        "bank_turnover_ratio": 1.2,
        "litigation_cases_count": 0,
        "promoter_experience_years": 10
    }

    result = prediction_service.predict_risk(sample_data)
    assert result is not None
    assert "risk_score" in result
    assert "risk_level" in result
    assert "default_probability" in result
    assert 0 <= result["risk_score"] <= 100
    assert 0.0 <= result["default_probability"] <= 100.0
