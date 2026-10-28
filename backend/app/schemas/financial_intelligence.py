"""
Pydantic schemas for the AI Financial Intelligence Engine.
Defines types for:
- Financial metrics & provenance
- Cash flow, revenue, expenses, liquidity, and debt repayment indicators
- Transaction classifications and analyst overrides
- Financial data quality breakdown (completeness, consistency, source reliability, reconciliation)
- Reconciliation analysis and discrepancies
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class FinancialMetricItem(BaseModel):
    id: int
    metric_key: str
    metric_name: str
    calculated_value: Optional[float] = None
    unit: str = "INR"
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    formula: Optional[str] = None
    provenance_type: str = "CALCULATED"  # CALCULATED | ESTIMATED | EXTRACTED | DECLARED | INDEPENDENTLY_VERIFIED
    data_completeness: str = "COMPLETE"  # COMPLETE | PARTIAL | INSUFFICIENT
    verification_limitations: Optional[str] = None
    source_records_summary: Dict[str, Any] = Field(default_factory=dict)
    is_stale: bool = False
    created_at: str

    class Config:
        from_attributes = True

class FinancialDiscrepancyItem(BaseModel):
    id: int
    discrepancy_code: str
    title: str
    severity: str  # LOW | MEDIUM | HIGH | CRITICAL
    affected_field: str
    expected_value: Optional[str] = None
    observed_value: Optional[str] = None
    source_document_id: Optional[int] = None
    reporting_period: Optional[str] = None
    difference_amount: Optional[float] = None
    difference_percentage: Optional[float] = None
    detection_rule: Optional[str] = None
    explanation: str
    verification_status: str  # OPEN | INVESTIGATING | RESOLVED | EXEMPTED | DISMISSED
    analyst_resolution: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True

class ResolveDiscrepancyRequest(BaseModel):
    status: str = Field(..., description="RESOLVED | EXEMPTED | DISMISSED | INVESTIGATING")
    resolution_notes: str = Field(..., min_length=3, description="Justification or evidence for resolution")

class TransactionClassificationItem(BaseModel):
    id: int
    bank_account_id: int
    bank_name: Optional[str] = None
    account_number_masked: Optional[str] = None
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

class OverrideTransactionCategoryRequest(BaseModel):
    new_category: str = Field(..., description="Valid financial transaction category")
    reason: str = Field(..., min_length=3, description="Underwriting reason for classification adjustment")

class CashFlowMetrics(BaseModel):
    total_credits: float
    total_debits: float
    net_cash_flow: float
    operating_cash_flow_estimate: Optional[float] = None
    monthly_average_net_flow: float
    cash_flow_volatility: float
    positive_flow_months: int
    negative_flow_months: int
    average_closing_balance: Optional[float] = None
    latest_closing_balance: Optional[float] = None
    provenance: str = "CALCULATED"
    limitations: str = ""

class RevenueIntelligence(BaseModel):
    declared_turnover: Optional[float] = None
    supporting_records_turnover: Optional[float] = None
    identified_business_receipts: float
    annualized_business_receipts: float
    quarter_over_quarter_growth: Optional[float] = None
    month_over_month_growth: Optional[float] = None
    revenue_concentration_top_month_pct: Optional[float] = None
    revenue_vs_declared_variance_pct: Optional[float] = None
    revenue_vs_gst_variance_pct: Optional[float] = None
    revenue_vs_pnl_variance_pct: Optional[float] = None
    reconciliation_status: str = "MATCHED"  # MATCHED | DIVERGENT | INSUFFICIENT_DATA
    reconciliation_notes: List[str] = Field(default_factory=list)

class ExpenseProfitabilityIntelligence(BaseModel):
    total_reported_expenses: float
    categorized_expenses: Dict[str, float] = Field(default_factory=dict)
    gross_profit: Optional[float] = None
    gross_margin_pct: Optional[float] = None
    operating_profit: Optional[float] = None
    operating_margin_pct: Optional[float] = None
    net_profit_estimate: Optional[float] = None
    net_profit_margin_pct: Optional[float] = None
    provenance: str = "CALCULATED"
    limitations: str = ""

class LiquidityIndicators(BaseModel):
    current_ratio: Optional[float] = None
    working_capital: Optional[float] = None
    cash_to_current_liabilities_ratio: Optional[float] = None
    liquidity_assessment: str = "Normal"
    formula: str = "Current Assets / Current Liabilities"
    limitations: str = ""

class DebtRepaymentIndicators(BaseModel):
    identified_existing_debt: float
    observed_loan_emis_total: float
    monthly_debt_service_burden: float
    annual_debt_service_burden: float
    cash_flow_debt_service_coverage: Optional[float] = None
    dscr: Optional[float] = None
    debt_to_equity: Optional[float] = None
    debt_evidence_summary: str = ""
    limitations: str = ""

class MonthlyTrendItem(BaseModel):
    month: str
    credits: float
    debits: float
    business_receipts: float
    internal_transfers: float
    net_cash_flow: float
    closing_balance: Optional[float] = None

class DataQualityBreakdown(BaseModel):
    overall_score: float  # 0 - 100
    tier: str  # EXCELLENT | GOOD | FAIR | POOR
    completeness_score: float
    consistency_score: float
    source_reliability_score: float
    reconciliation_score: float
    quality_factors: List[Dict[str, Any]] = Field(default_factory=list)
    limitations_and_disclosures: List[str] = Field(default_factory=list)

class FinancialIntelligenceSummaryResponse(BaseModel):
    business_id: Optional[int] = None
    business_name: Optional[str] = None
    user_id: str
    accounts_count: int
    statement_coverage_months: int
    reporting_period: str
    missing_periods: List[str] = Field(default_factory=list)
    has_coverage_gaps: bool = False
    cash_flow: CashFlowMetrics
    revenue: RevenueIntelligence
    expenses_profitability: ExpenseProfitabilityIntelligence
    liquidity: LiquidityIndicators
    debt_repayment: DebtRepaymentIndicators
    monthly_trends: List[MonthlyTrendItem] = Field(default_factory=list)
    data_quality: DataQualityBreakdown
    open_discrepancies_count: int = 0
    last_recalculated_at: str
    disclosures: Dict[str, str] = Field(default_factory=dict)

class PaginatedTransactionsResponse(BaseModel):
    total_count: int
    page: int
    limit: int
    transactions: List[TransactionClassificationItem]
    categories_summary: Dict[str, float]
    internal_transfers_count: int
    internal_transfers_total: float

class RecalculateResponse(BaseModel):
    status: str
    message: str
    run_id: int
    data_quality_score: float
    open_discrepancies_count: int
    recalculated_at: str
