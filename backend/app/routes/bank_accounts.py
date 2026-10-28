"""
FastAPI router for Multiple Bank Accounts & Consolidated Statement Analysis
Endpoints:
- GET /bank-accounts: List registered bank accounts
- POST /bank-accounts: Register new business bank account
- GET /bank-accounts/{id}: Get bank account details and transactions
- DELETE /bank-accounts/{id}: Delete bank account
- POST /bank-accounts/{id}/upload-statement: Upload and process statement transactions
- GET /bank-accounts/consolidated-analysis: Consolidated multi-account metrics and reconciliation
- POST /bank-accounts/transactions/{tx_id}/override-category: Underwriter category override
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user
from ..schemas.identity_and_bank import (
    BankAccountCreateRequest,
    BankAccountResponse,
    BankTransactionItem,
    StatementUploadTransactionsRequest,
    ConsolidatedBankAnalysisResponse,
    TransactionCategoryOverrideRequest
)
from ..services.bank_analysis_service import BankAnalysisService
from ..services.audit_service import log_audit_event

router = APIRouter(prefix="/bank-accounts", tags=["Bank Accounts & Multi-Bank Analysis"])

def to_bank_account_response(acc: models.BankAccount) -> BankAccountResponse:
    return BankAccountResponse(
        id=acc.id,
        user_id=acc.user_id,
        business_id=acc.business_id,
        bank_name=acc.bank_name,
        account_number_masked=acc.account_number_masked,
        account_type=acc.account_type,
        ifsc_code=acc.ifsc_code,
        account_holder_name=acc.account_holder_name,
        is_primary=acc.is_primary,
        reporting_period_start=acc.reporting_period_start,
        reporting_period_end=acc.reporting_period_end,
        verification_status=acc.verification_status,
        extracted_summary=acc.extracted_summary or {},
        created_at=acc.created_at.isoformat() if acc.created_at else ""
    )

def to_transaction_item(tx: models.BankTransaction) -> BankTransactionItem:
    return BankTransactionItem(
        id=tx.id,
        bank_account_id=tx.bank_account_id,
        transaction_date=tx.transaction_date,
        description=tx.description,
        reference_no=tx.reference_no,
        debit=tx.debit,
        credit=tx.credit,
        balance=tx.balance,
        category=tx.category,
        is_internal_transfer=tx.is_internal_transfer,
        transfer_confidence=tx.transfer_confidence,
        matched_account_id=tx.matched_account_id,
        analyst_reviewed=tx.analyst_reviewed,
        analyst_category_override=tx.analyst_category_override
    )

@router.get("", response_model=List[BankAccountResponse])
def list_bank_accounts(
    business_id: Optional[int] = None,
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists registered business bank accounts with masked account numbers."""
    lookup_uid = current_user.uid
    if target_user_id and target_user_id != current_user.uid:
        if current_user.role not in ["analyst", "admin"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized access.")
        lookup_uid = target_user_id

    service = BankAnalysisService(db)
    accounts = service.get_user_bank_accounts(lookup_uid, business_id)
    return [to_bank_account_response(a) for a in accounts]

@router.post("", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
def register_bank_account(
    payload: BankAccountCreateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Registers a new business bank account with minimal masked metadata.
    Does NOT request online banking passwords, PINs, or OTPs.
    """
    if payload.business_id:
        bus = db.query(models.Business).filter(models.Business.id == payload.business_id).first()
        if not bus or (bus.user_id != current_user.uid and current_user.role not in ["analyst", "admin"]):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized business access.")

    service = BankAnalysisService(db)
    account = service.register_bank_account(
        user_id=current_user.uid,
        business_id=payload.business_id,
        bank_name=payload.bank_name,
        account_number=payload.account_number,
        account_type=payload.account_type,
        ifsc_code=payload.ifsc_code,
        account_holder_name=payload.account_holder_name,
        is_primary=payload.is_primary
    )

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="REGISTER_BANK_ACCOUNT",
        resource_type="bank_account",
        resource_id=str(account.id),
        details={"bank_name": account.bank_name, "masked_account": account.account_number_masked}
    )

    return to_bank_account_response(account)

@router.get("/consolidated-analysis", response_model=ConsolidatedBankAnalysisResponse)
def get_consolidated_analysis(
    business_id: Optional[int] = None,
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Generates consolidated multi-account financial analysis across all registered bank accounts.
    Deduplicates internal transfers, detects EMI debt obligations, and reconciles against declared revenue & GST.
    """
    lookup_uid = current_user.uid
    if target_user_id and target_user_id != current_user.uid:
        if current_user.role not in ["analyst", "admin"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized access.")
        lookup_uid = target_user_id

    service = BankAnalysisService(db)
    analysis = service.generate_consolidated_analysis(lookup_uid, business_id)
    return analysis

@router.get("/{id}", response_model=Dict[str, Any])
def get_bank_account_details(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns bank account details and recent transaction ledger entries."""
    account = db.query(models.BankAccount).filter(models.BankAccount.id == id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank account not found.")

    if account.user_id != current_user.uid and current_user.role not in ["analyst", "admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized access to bank account.")

    transactions = (
        db.query(models.BankTransaction)
        .filter(models.BankTransaction.bank_account_id == id)
        .order_by(models.BankTransaction.transaction_date.desc())
        .limit(200)
        .all()
    )

    return {
        "account": to_bank_account_response(account),
        "transactions": [to_transaction_item(t) for t in transactions]
    }

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bank_account(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Removes a registered bank account and its statement transaction entries."""
    account = db.query(models.BankAccount).filter(models.BankAccount.id == id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank account not found.")

    if account.user_id != current_user.uid and current_user.role not in ["admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized deletion.")

    db.delete(account)
    db.commit()

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="DELETE_BANK_ACCOUNT",
        resource_type="bank_account",
        resource_id=str(id),
        details={"bank_name": account.bank_name, "masked_account": account.account_number_masked}
    )
    return None

@router.post("/{id}/upload-statement", response_model=Dict[str, Any])
def upload_statement_transactions(
    id: int,
    payload: StatementUploadTransactionsRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits extracted transaction entries for a specific bank account.
    Executes arithmetic consistency verification and contra transfer detection.
    """
    account = db.query(models.BankAccount).filter(models.BankAccount.id == id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank account not found.")

    if account.user_id != current_user.uid and current_user.role not in ["analyst", "admin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized access.")

    # If document_id provided, verify ownership
    doc_id = payload.document_id
    if doc_id:
        doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
        if not doc or (doc.user_id != current_user.uid and current_user.role not in ["analyst", "admin"]):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized document reference.")

    service = BankAnalysisService(db)
    summary = service.process_statement_transactions(
        bank_account_id=id,
        document_id=doc_id or 0,
        transactions_data=payload.transactions,
        opening_balance=payload.opening_balance,
        closing_balance=payload.closing_balance,
        period_start=payload.period_start,
        period_end=payload.period_end
    )

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="PROCESS_BANK_STATEMENT",
        resource_type="bank_account",
        resource_id=str(id),
        details=summary
    )

    return {
        "bank_account_id": id,
        "summary": summary,
        "status": account.verification_status
    }

@router.post("/transactions/{transaction_id}/override-category", response_model=BankTransactionItem)
def override_transaction_category(
    transaction_id: int,
    payload: TransactionCategoryOverrideRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Enables an underwriter or applicant to override an uncertain transaction category
    or label a detected transfer.
    """
    tx = db.query(models.BankTransaction).filter(models.BankTransaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found.")

    account = db.query(models.BankAccount).filter(models.BankAccount.id == tx.bank_account_id).first()
    if not account or (account.user_id != current_user.uid and current_user.role not in ["analyst", "admin"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized access.")

    tx.analyst_reviewed = True
    tx.analyst_category_override = payload.category
    tx.category = payload.category
    if payload.is_internal_transfer is not None:
        tx.is_internal_transfer = payload.is_internal_transfer

    db.commit()
    db.refresh(tx)

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="OVERRIDE_TRANSACTION_CATEGORY",
        resource_type="bank_transaction",
        resource_id=str(tx.id),
        details={"category": payload.category, "notes": payload.notes}
    )

    return to_transaction_item(tx)
