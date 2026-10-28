"""
Pydantic schemas for Identity Verification (PAN & Aadhaar) and Multi-Bank Analysis.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# ----------------- IDENTITY VERIFICATION SCHEMAS -----------------

class PANVerificationRequest(BaseModel):
    business_id: Optional[int] = None
    document_id: Optional[int] = None
    pan_number: str = Field(..., description="10-character PAN identifier")
    name_on_pan: Optional[str] = None
    dob_or_incorporation: Optional[str] = None

class AadhaarVerificationRequest(BaseModel):
    business_id: Optional[int] = None
    document_id: Optional[int] = None
    aadhaar_number: str = Field(..., description="12-digit Aadhaar number (will be immediately masked)")
    name_on_aadhaar: Optional[str] = None
    dob: Optional[str] = None
    consent_obtained: bool = Field(..., description="Mandatory informed consent confirmation")

class AnalystIdentityReviewRequest(BaseModel):
    decision: str = Field(..., description="APPROVED | REJECTED | INVESTIGATION_REQUIRED | NEEDS_CLARIFICATION")
    notes: Optional[str] = None

class IdentityVerificationResponse(BaseModel):
    id: int
    user_id: str
    business_id: Optional[int] = None
    document_id: Optional[int] = None
    id_type: str
    masked_id: str
    name_on_doc: Optional[str] = None
    entity_type: Optional[str] = None
    consent_obtained: bool
    document_uploaded: bool
    text_extracted: bool
    extraction_confidence: float
    format_valid: bool
    format_validation_notes: Optional[str] = None
    declared_name_match: bool
    name_match_score: float
    declared_details_match: bool
    match_breakdown: Dict[str, Any]
    external_verification_status: str
    external_verification_source: Optional[str] = None
    external_verification_ref: Optional[str] = None
    external_verification_message: Optional[str] = None
    manual_review_status: str
    analyst_decision: Optional[str] = None
    analyst_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True

class IdentityStatusResponse(BaseModel):
    pan_verification: Optional[IdentityVerificationResponse] = None
    aadhaar_verification: Optional[IdentityVerificationResponse] = None
    all_identities_verified: bool = False
    requires_manual_review: bool = True
    summary: str


# ----------------- BANK ACCOUNT & STATEMENT SCHEMAS -----------------

class BankAccountCreateRequest(BaseModel):
    business_id: Optional[int] = None
    bank_name: str
    account_number: str
    account_type: str = "CURRENT"  # CURRENT | SAVINGS | CASH_CREDIT | OVERDRAFT
    ifsc_code: Optional[str] = None
    account_holder_name: Optional[str] = None
    is_primary: bool = False

class BankAccountResponse(BaseModel):
    id: int
    user_id: str
    business_id: Optional[int] = None
    bank_name: str
    account_number_masked: str
    account_type: str
    ifsc_code: Optional[str] = None
    account_holder_name: Optional[str] = None
    is_primary: bool
    reporting_period_start: Optional[str] = None
    reporting_period_end: Optional[str] = None
    verification_status: str
    extracted_summary: Dict[str, Any]
    created_at: str

    class Config:
        from_attributes = True

class BankTransactionItem(BaseModel):
    id: int
    bank_account_id: int
    transaction_date: str
    description: str
    reference_no: Optional[str] = None
    debit: float
    credit: float
    balance: Optional[float] = None
    category: str
    is_internal_transfer: bool
    transfer_confidence: float
    matched_account_id: Optional[int] = None
    analyst_reviewed: bool
    analyst_category_override: Optional[str] = None

    class Config:
        from_attributes = True

class StatementUploadTransactionsRequest(BaseModel):
    document_id: Optional[int] = None
    transactions: List[Dict[str, Any]]
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None

class TransactionCategoryOverrideRequest(BaseModel):
    category: str = Field(..., description="sales_receipt | own_account_transfer | loan_proceeds | refund | capital_injection | loan_repayment_emi | operating_expense | tax_payment | unknown")
    is_internal_transfer: Optional[bool] = None
    notes: Optional[str] = None


# ----------------- CONSOLIDATED ANALYSIS SCHEMAS -----------------

class ContributingAccountItem(BaseModel):
    id: int
    bank_name: str
    account_number_masked: str
    account_type: str
    is_primary: bool
    verification_status: str
    reporting_period: str
    total_credits: float
    total_debits: float
    arithmetic_consistent: bool

class MonthlyTrendItem(BaseModel):
    month: str
    credits: float
    debits: float
    business_receipts: float
    internal_transfers: float
    net_cash_flow: float

class ConsolidatedMetrics(BaseModel):
    total_credits: float
    total_debits: float
    internal_transfers_deducted: float
    loan_proceeds_deducted: float
    estimated_business_receipts: float
    annualized_business_receipts: float
    net_cash_flow: float
    average_balance: float
    latest_closing_balance: float
    observed_loan_repayments_total: float
    monthly_emi_run_rate: float
    statement_coverage_months: int
    reporting_window: str
    missing_months: List[str]
    has_coverage_gaps: bool
    monthly_trends: List[MonthlyTrendItem]

class ReconciliationData(BaseModel):
    declared_annual_revenue: float
    annualized_bank_receipts: float
    revenue_variance_pct: float
    gst_turnover: float
    gst_variance_pct: float
    pnl_revenue: float
    pnl_variance_pct: float
    reconciliation_notes: List[str]

class ConsolidatedDisclosures(BaseModel):
    calculation_basis: str
    data_limitations: str
    independent_verification_status: str

class ConsolidatedBankAnalysisResponse(BaseModel):
    has_sufficient_data: bool
    accounts_count: int
    contributing_accounts: List[ContributingAccountItem]
    metrics: Optional[ConsolidatedMetrics] = None
    reconciliation: Optional[ReconciliationData] = None
    disclosures: Optional[ConsolidatedDisclosures] = None
    message: Optional[str] = None


# ----------------- APPLICANT CORRECTION SCHEMAS -----------------

class ApplicantCorrectionCreateRequest(BaseModel):
    business_id: int
    field_name: str
    original_value: Optional[str] = None
    corrected_value: str
    reason: str
    replaced_document_id: Optional[int] = None
    new_document_id: Optional[int] = None

class ApplicantCorrectionReviewRequest(BaseModel):
    decision: str = Field(..., description="ACCEPTED | REJECTED")
    notes: Optional[str] = None

class ApplicantCorrectionResponse(BaseModel):
    id: int
    user_id: str
    business_id: int
    field_name: str
    original_value: Optional[str] = None
    corrected_value: str
    reason: str
    replaced_document_id: Optional[int] = None
    new_document_id: Optional[int] = None
    submitted_by: str
    status: str
    analyst_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: str
    recalculated_at: Optional[str] = None

    class Config:
        from_attributes = True
