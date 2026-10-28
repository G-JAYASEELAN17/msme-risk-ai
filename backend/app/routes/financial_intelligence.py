"""
FastAPI router for the AI Financial Intelligence Engine.
Authenticated endpoints for:
- Summary profile & KPIs
- Account-level and consolidated bank intelligence
- Monthly financial trends
- Paginated transaction stream with categorization
- Analyst classification overrides & audit logs
- Multi-source reconciliation (declared vs bank vs GST vs P&L)
- Automated discrepancy detection and analyst resolution
- Provenance registry for financial metrics
- Manual and automatic recalculation
- Dimensional data quality assessment
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user
from ..schemas.financial_intelligence import (
    FinancialIntelligenceSummaryResponse,
    PaginatedTransactionsResponse,
    TransactionClassificationItem,
    OverrideTransactionCategoryRequest,
    FinancialDiscrepancyItem,
    ResolveDiscrepancyRequest,
    FinancialMetricItem,
    RecalculateResponse,
    DataQualityBreakdown
)
from ..services.financial_intelligence_service import FinancialIntelligenceService
from ..services.audit_service import log_audit_event

router = APIRouter(prefix="/financial-intelligence", tags=["AI Financial Intelligence Engine"])


def resolve_target_user(
    current_user: models.User,
    target_user_id: Optional[str] = None,
    user_id: Optional[str] = None
) -> str:
    """Strict IDOR protection: only analysts and admins may inspect other users' data."""
    effective_target = target_user_id or user_id
    if not effective_target or effective_target == current_user.uid:
        return current_user.uid

    user_role = (current_user.role or "").lower()
    if user_role not in ["analyst", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized access. You may only view your own financial records."
        )
    return effective_target


def to_discrepancy_item(d: models.FinancialDiscrepancy) -> FinancialDiscrepancyItem:
    return FinancialDiscrepancyItem(
        id=d.id,
        discrepancy_code=d.discrepancy_code,
        title=d.title,
        severity=d.severity,
        affected_field=d.affected_field,
        expected_value=d.expected_value,
        observed_value=d.observed_value,
        source_document_id=d.source_document_id,
        reporting_period=d.reporting_period,
        difference_amount=d.difference_amount,
        difference_percentage=d.difference_percentage,
        detection_rule=d.detection_rule,
        explanation=d.explanation,
        verification_status=d.verification_status,
        analyst_resolution=d.analyst_resolution,
        resolved_by=d.resolved_by,
        resolved_at=d.resolved_at.isoformat() if d.resolved_at else None,
        created_at=d.created_at.isoformat() if d.created_at else ""
    )


def to_metric_item(m: models.FinancialMetricRecord) -> FinancialMetricItem:
    return FinancialMetricItem(
        id=m.id,
        metric_key=m.metric_key,
        metric_name=m.metric_name,
        calculated_value=m.calculated_value,
        unit=m.unit,
        period_start=m.period_start,
        period_end=m.period_end,
        formula=m.formula,
        provenance_type=m.provenance_type,
        data_completeness=m.data_completeness,
        verification_limitations=m.verification_limitations,
        source_records_summary=m.source_records_summary or {},
        is_stale=m.is_stale,
        created_at=m.created_at.isoformat() if m.created_at else ""
    )


@router.get("/summary", response_model=FinancialIntelligenceSummaryResponse)
def get_financial_intelligence_summary(
    business_id: Optional[int] = None,
    target_user_id: Optional[str] = None,
    user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns consolidated, traceable financial profile:
    - Cash-flow indicators
    - Revenue intelligence
    - Expense & profitability
    - Liquidity & debt obligations
    - Reconciliation & Data Quality breakdown
    """
    lookup_uid = resolve_target_user(current_user, target_user_id, user_id)
    service = FinancialIntelligenceService(db)
    summary = service.calculate_financial_intelligence(lookup_uid, business_id, trigger_source="SUMMARY_FETCH")
    return summary


@router.get("/accounts")
def get_account_level_metrics(
    business_id: Optional[int] = None,
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns account-level analysis across all authorized bank accounts."""
    lookup_uid = resolve_target_user(current_user, target_user_id)
    accounts = db.query(models.BankAccount).filter(models.BankAccount.user_id == lookup_uid)
    if business_id:
        accounts = accounts.filter(models.BankAccount.business_id == business_id)
    account_list = accounts.order_by(models.BankAccount.is_primary.desc()).all()

    acc_ids = [acc.id for acc in account_list]
    tx_counts: Dict[int, int] = {}
    if acc_ids:
        from sqlalchemy import func
        counts = db.query(
            models.BankTransaction.bank_account_id,
            func.count(models.BankTransaction.id)
        ).filter(
            models.BankTransaction.bank_account_id.in_(acc_ids)
        ).group_by(models.BankTransaction.bank_account_id).all()
        tx_counts = {acc_id: int(count) for acc_id, count in counts}

    results = []
    for acc in account_list:
        summary = acc.extracted_summary or {}
        tx_count = tx_counts.get(acc.id, 0)
        results.append({
            "id": acc.id,
            "bank_name": acc.bank_name,
            "account_number_masked": acc.account_number_masked,
            "account_type": acc.account_type,
            "is_primary": acc.is_primary,
            "verification_status": acc.verification_status,
            "reporting_period": summary.get("reporting_period", "Unspecified"),
            "total_credits": summary.get("total_credits", 0.0),
            "total_debits": summary.get("total_debits", 0.0),
            "net_flow": summary.get("net_flow", 0.0),
            "opening_balance": summary.get("opening_balance"),
            "closing_balance": summary.get("closing_balance"),
            "transaction_count": tx_count,
            "arithmetic_consistent": summary.get("arithmetic_consistent", True),
            "arithmetic_delta": summary.get("arithmetic_delta", 0.0),
            "detected_emi_total": summary.get("detected_emi_total", 0.0)
        })
    return results


@router.get("/consolidated-accounts")
def get_consolidated_accounts_metrics(
    business_id: Optional[int] = None,
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Consolidated cross-account metrics and duplicate/contra transfer deduplication summary."""
    lookup_uid = resolve_target_user(current_user, target_user_id)
    service = FinancialIntelligenceService(db)
    summary = service.calculate_financial_intelligence(lookup_uid, business_id)
    return {
        "accounts_count": summary["accounts_count"],
        "statement_coverage_months": summary["statement_coverage_months"],
        "reporting_period": summary["reporting_period"],
        "missing_periods": summary["missing_periods"],
        "has_coverage_gaps": summary["has_coverage_gaps"],
        "cash_flow": summary["cash_flow"],
        "revenue": summary["revenue"],
        "debt_repayment": summary["debt_repayment"],
        "disclosures": summary["disclosures"]
    }


@router.get("/trends")
def get_financial_trends(
    business_id: Optional[int] = None,
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Monthly financial trends for cash flow, business receipts, and balances."""
    lookup_uid = resolve_target_user(current_user, target_user_id)
    service = FinancialIntelligenceService(db)
    summary = service.calculate_financial_intelligence(lookup_uid, business_id)
    return {
        "monthly_trends": summary["monthly_trends"],
        "coverage_months": summary["statement_coverage_months"],
        "reporting_period": summary["reporting_period"]
    }


@router.get("/transactions", response_model=PaginatedTransactionsResponse)
def get_classified_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    bank_account_id: Optional[int] = None,
    category: Optional[str] = None,
    is_internal_transfer: Optional[bool] = None,
    search: Optional[str] = None,
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Paginated transaction query with category and internal transfer filtering."""
    lookup_uid = resolve_target_user(current_user, target_user_id)

    # Validate accounts owned by this user
    user_accounts = db.query(models.BankAccount).filter(models.BankAccount.user_id == lookup_uid).all()
    user_acc_ids = [a.id for a in user_accounts]
    acc_map = {a.id: (a.bank_name, a.account_number_masked) for a in user_accounts}

    if not user_acc_ids:
        return PaginatedTransactionsResponse(
            total_count=0,
            page=page,
            limit=limit,
            transactions=[],
            categories_summary={},
            internal_transfers_count=0,
            internal_transfers_total=0.0
        )

    q = db.query(models.BankTransaction).filter(models.BankTransaction.bank_account_id.in_(user_acc_ids))

    if bank_account_id:
        if bank_account_id not in user_acc_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized account access.")
        q = q.filter(models.BankTransaction.bank_account_id == bank_account_id)

    if category:
        q = q.filter(
            or_(
                models.BankTransaction.analyst_category_override == category,
                and_(
                    models.BankTransaction.analyst_category_override.is_(None),
                    models.BankTransaction.category == category
                )
            )
        )

    if is_internal_transfer is not None:
        q = q.filter(models.BankTransaction.is_internal_transfer == is_internal_transfer)

    if search:
        search_term = f"%{search.strip().lower()}%"
        q = q.filter(
            or_(
                models.BankTransaction.description.ilike(search_term),
                models.BankTransaction.reference_no.ilike(search_term)
            )
        )

    total_count = q.count()
    raw_txs = q.order_by(models.BankTransaction.transaction_date.desc(), models.BankTransaction.id.desc()) \
               .offset((page - 1) * limit) \
               .limit(limit) \
               .all()

    # Category summary aggregates via efficient database aggregation
    from sqlalchemy import func, case
    effective_cat = func.coalesce(models.BankTransaction.analyst_category_override, models.BankTransaction.category)
    amt_expr = case((models.BankTransaction.credit > 0, models.BankTransaction.credit), else_=models.BankTransaction.debit)

    cat_rows = db.query(
        effective_cat.label("category"),
        func.sum(amt_expr).label("total_amount")
    ).filter(
        models.BankTransaction.bank_account_id.in_(user_acc_ids)
    ).group_by(effective_cat).all()

    cat_summary: Dict[str, float] = {
        r.category: round(float(r.total_amount or 0.0), 2)
        for r in cat_rows if r.category
    }

    contra_stats = db.query(
        func.count(models.BankTransaction.id),
        func.sum(models.BankTransaction.credit)
    ).filter(
        models.BankTransaction.bank_account_id.in_(user_acc_ids),
        models.BankTransaction.is_internal_transfer == True
    ).first()

    contra_count = int(contra_stats[0] or 0) if contra_stats else 0
    contra_total = round(float(contra_stats[1] or 0.0), 2) if contra_stats else 0.0

    items = []
    for t in raw_txs:
        bank_name, acc_masked = acc_map.get(t.bank_account_id, ("Bank", "XXXX"))
        items.append(
            TransactionClassificationItem(
                id=t.id,
                bank_account_id=t.bank_account_id,
                bank_name=bank_name,
                account_number_masked=acc_masked,
                transaction_date=t.transaction_date,
                description=t.description,
                reference_no=t.reference_no,
                debit=t.debit,
                credit=t.credit,
                balance=t.balance,
                category=t.analyst_category_override or t.category,
                is_internal_transfer=t.is_internal_transfer,
                transfer_confidence=t.transfer_confidence,
                matched_account_id=t.matched_account_id,
                analyst_reviewed=t.analyst_reviewed,
                analyst_category_override=t.analyst_category_override
            )
        )

    return PaginatedTransactionsResponse(
        total_count=total_count,
        page=page,
        limit=limit,
        transactions=items,
        categories_summary=cat_summary,
        internal_transfers_count=contra_count,
        internal_transfers_total=round(contra_total, 2)
    )


@router.patch("/transactions/{id}/classification", response_model=TransactionClassificationItem)
def override_transaction_classification(
    id: int,
    payload: OverrideTransactionCategoryRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyst classification override:
    Allows authorized credit analysts to correct a transaction category with an audit trail.
    """
    if current_user.role not in ["analyst", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Underwriter privilege required to modify transaction classifications."
        )

    service = FinancialIntelligenceService(db)
    try:
        updated = service.override_transaction_category(
            transaction_id=id,
            new_category=payload.new_category,
            reason=payload.reason,
            analyst_uid=current_user.uid
        )
        acc = db.query(models.BankAccount).filter(models.BankAccount.id == updated.bank_account_id).first()
        log_audit_event(
            db,
            user_id=current_user.uid,
            action="OVERRIDE_TRANSACTION_CATEGORY",
            resource_type="financial_transaction",
            resource_id=str(id),
            details={
                "transaction_id": id,
                "new_category": payload.new_category,
                "reason": payload.reason,
                "analyst_name": current_user.name or current_user.email
            }
        )
        return TransactionClassificationItem(
            id=updated.id,
            bank_account_id=updated.bank_account_id,
            bank_name=acc.bank_name if acc else None,
            account_number_masked=acc.account_number_masked if acc else None,
            transaction_date=updated.transaction_date,
            description=updated.description,
            reference_no=updated.reference_no,
            debit=updated.debit,
            credit=updated.credit,
            balance=updated.balance,
            category=updated.analyst_category_override or updated.category,
            is_internal_transfer=updated.is_internal_transfer,
            transfer_confidence=updated.transfer_confidence,
            matched_account_id=updated.matched_account_id,
            analyst_reviewed=updated.analyst_reviewed,
            analyst_category_override=updated.analyst_category_override
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/reconciliation")
def get_reconciliation_details(
    business_id: Optional[int] = None,
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Multi-source revenue reconciliation: Declared turnover vs Bank deposits vs GST vs P&L."""
    lookup_uid = resolve_target_user(current_user, target_user_id)
    service = FinancialIntelligenceService(db)
    summary = service.calculate_financial_intelligence(lookup_uid, business_id)
    return summary["revenue"]


@router.get("/discrepancies", response_model=List[FinancialDiscrepancyItem])
def list_discrepancies(
    status: Optional[str] = None,
    business_id: Optional[int] = None,
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lists financial discrepancies detected across statements, filings, and declarations."""
    lookup_uid = resolve_target_user(current_user, target_user_id)
    service = FinancialIntelligenceService(db)
    discrepancies = service.get_discrepancies(lookup_uid, business_id, status)
    return [to_discrepancy_item(d) for d in discrepancies]


@router.post("/discrepancies/{id}/resolve", response_model=FinancialDiscrepancyItem)
def resolve_discrepancy(
    id: int,
    payload: ResolveDiscrepancyRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyst discrepancy resolution:
    Allows credit underwriter to resolve or dismiss a flagged discrepancy with evidence notes.
    """
    if current_user.role not in ["analyst", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Underwriter privilege required to resolve discrepancies."
        )

    service = FinancialIntelligenceService(db)
    try:
        resolved = service.resolve_discrepancy(
            discrepancy_id=id,
            status=payload.status,
            notes=payload.resolution_notes,
            analyst_uid=current_user.uid
        )
        log_audit_event(
            db,
            user_id=current_user.uid,
            action="RESOLVE_FINANCIAL_DISCREPANCY",
            resource_type="financial_discrepancy",
            resource_id=str(id),
            details={
                "discrepancy_id": id,
                "status": payload.status,
                "notes": payload.resolution_notes
            }
        )
        return to_discrepancy_item(resolved)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/provenance", response_model=List[FinancialMetricItem])
def get_provenance_registry(
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns provenance metadata registry for all calculated financial facts and estimates."""
    lookup_uid = resolve_target_user(current_user, target_user_id)
    service = FinancialIntelligenceService(db)
    metrics = service.get_provenance_registry(lookup_uid)
    return [to_metric_item(m) for m in metrics]


@router.post("/recalculate", response_model=RecalculateResponse)
def recalculate_financial_intelligence(
    business_id: Optional[int] = None,
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Triggers idempotent recalculation of financial intelligence metrics after document or category updates."""
    lookup_uid = resolve_target_user(current_user, target_user_id)
    service = FinancialIntelligenceService(db)
    summary = service.calculate_financial_intelligence(lookup_uid, business_id, trigger_source="MANUAL_RECALCULATE")

    last_run = db.query(models.FinancialAnalysisRun).filter(
        models.FinancialAnalysisRun.user_id == lookup_uid
    ).order_by(models.FinancialAnalysisRun.started_at.desc()).first()

    return RecalculateResponse(
        status="SUCCESS",
        message="Financial intelligence metrics recalculated successfully.",
        run_id=last_run.id if last_run else 0,
        data_quality_score=summary["data_quality"]["overall_score"],
        open_discrepancies_count=summary["open_discrepancies_count"],
        recalculated_at=summary["last_recalculated_at"]
    )


@router.get("/data-quality", response_model=DataQualityBreakdown)
def get_data_quality_assessment(
    business_id: Optional[int] = None,
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns detailed 4-dimensional data reliability index (Completeness, Consistency, Source Quality, Reconciliation)."""
    lookup_uid = resolve_target_user(current_user, target_user_id)
    service = FinancialIntelligenceService(db)
    summary = service.calculate_financial_intelligence(lookup_uid, business_id)
    return summary["data_quality"]


@router.get("/review-history")
def get_analyst_review_history(
    target_user_id: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Audit log history of transaction category overrides and discrepancy resolutions."""
    lookup_uid = resolve_target_user(current_user, target_user_id)

    # Audits on transactions
    tx_audits = db.query(models.TransactionClassificationAudit).filter(
        models.TransactionClassificationAudit.user_id == lookup_uid
    ).order_by(models.TransactionClassificationAudit.created_at.desc()).all()

    # Resolved discrepancies
    resolved_discs = db.query(models.FinancialDiscrepancy).filter(
        models.FinancialDiscrepancy.user_id == lookup_uid,
        models.FinancialDiscrepancy.verification_status.in_(["RESOLVED", "EXEMPTED", "DISMISSED"])
    ).order_by(models.FinancialDiscrepancy.resolved_at.desc()).all()

    return {
        "transaction_classification_overrides": [
            {
                "id": a.id,
                "transaction_id": a.transaction_id,
                "previous_category": a.previous_category,
                "new_category": a.new_category,
                "reason": a.reason,
                "performed_by": a.performed_by,
                "created_at": a.created_at.isoformat()
            }
            for a in tx_audits
        ],
        "resolved_discrepancies": [to_discrepancy_item(d) for d in resolved_discs]
    }
