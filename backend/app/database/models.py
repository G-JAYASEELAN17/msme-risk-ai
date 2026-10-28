import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean, Text
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    
    uid = Column(String, primary_key=True, index=True)  # Firebase UID
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    role = Column(String, default="user", nullable=False)  # user | analyst | admin
    approval_status = Column(String, default="approved", nullable=False, index=True)  # pending_email_verification | pending_admin_approval | approved | active | rejected | suspended | revoked
    email_verified_at = Column(DateTime, nullable=True)
    organization = Column(String, nullable=True)
    qualifications = Column(Text, nullable=True)
    experience_years = Column(String, nullable=True)
    application_reason = Column(Text, nullable=True)
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_by = Column(String, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    suspended_at = Column(DateTime, nullable=True)
    settings = Column(JSON, default=dict, nullable=False)  # notification prefs, onboarding status, etc.
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    businesses = relationship("Business", back_populates="owner", cascade="all, delete-orphan", lazy="selectin")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    alert_rules = relationship("AlertRule", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    identity_verifications = relationship("IdentityVerification", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    bank_accounts = relationship("BankAccount", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    corrections = relationship("ApplicantCorrection", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    financial_metrics = relationship("FinancialMetricRecord", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    financial_discrepancies = relationship("FinancialDiscrepancy", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    financial_analysis_runs = relationship("FinancialAnalysisRun", back_populates="user", cascade="all, delete-orphan", lazy="selectin")

class Business(Base):
    __tablename__ = "businesses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, index=True, nullable=False)
    industry = Column(String, nullable=False)
    location = Column(String, nullable=True, default="United States")
    description = Column(Text, nullable=True)
    age = Column(Integer, nullable=False)  # Business age in years
    employees = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    owner = relationship("User", back_populates="businesses")
    assessments = relationship("Assessment", back_populates="business", cascade="all, delete-orphan", lazy="selectin")
    documents = relationship("Document", back_populates="business", cascade="all, delete-orphan", lazy="selectin")
    bank_accounts = relationship("BankAccount", back_populates="business", cascade="all, delete-orphan", lazy="selectin")
    identity_verifications = relationship("IdentityVerification", back_populates="business", cascade="all, delete-orphan", lazy="selectin")
    corrections = relationship("ApplicantCorrection", back_populates="business", cascade="all, delete-orphan", lazy="selectin")
    financial_metrics = relationship("FinancialMetricRecord", back_populates="business", cascade="all, delete-orphan", lazy="selectin")
    financial_discrepancies = relationship("FinancialDiscrepancy", back_populates="business", cascade="all, delete-orphan", lazy="selectin")
    financial_analysis_runs = relationship("FinancialAnalysisRun", back_populates="business", cascade="all, delete-orphan", lazy="selectin")

class Assessment(Base):
    __tablename__ = "assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    annual_revenue = Column(Float, nullable=False)
    monthly_cash_flow = Column(Float, nullable=False)
    monthly_expenses = Column(Float, nullable=False)
    existing_debt = Column(Float, nullable=False)
    digital_transactions = Column(Integer, nullable=False)  # Transactions per month
    utility_payment_score = Column(Float, nullable=False)   # Score / 100
    invoice_payment_score = Column(Float, nullable=False)   # Score / 100
    previous_defaults = Column(Integer, nullable=False)     # Number of defaults
    review_status = Column(String, default="pending", nullable=False, index=True) # pending | in_review | approved | rejected | needs_info
    review_notes = Column(Text, nullable=True)
    additional_comments = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)             # Analyst UID
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    business = relationship("Business", back_populates="assessments")
    prediction = relationship("Prediction", back_populates="assessment", uselist=False, cascade="all, delete-orphan", lazy="selectin")
    report = relationship("Report", back_populates="assessment", uselist=False, cascade="all, delete-orphan", lazy="selectin")
    model_explanation = relationship("ModelExplanation", back_populates="assessment", uselist=False, cascade="all, delete-orphan", lazy="selectin")
    counterfactual_simulations = relationship("CounterfactualSimulation", back_populates="assessment", cascade="all, delete-orphan", lazy="selectin")
    policy_evaluations = relationship("PolicyEvaluation", back_populates="assessment", cascade="all, delete-orphan", lazy="selectin")
    credit_reviews = relationship("CreditReviewRecord", back_populates="assessment", cascade="all, delete-orphan", lazy="selectin")
    decision_overrides = relationship("DecisionOverride", back_populates="assessment", cascade="all, delete-orphan", lazy="selectin")

class Prediction(Base):
    __tablename__ = "predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    default_probability = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False, index=True)  # LOW / MEDIUM / HIGH
    risk_score = Column(Float, nullable=True, default=0.0)  # Normalized 0-100 risk score
    confidence = Column(Float, nullable=False)
    data_quality_score = Column(Float, nullable=True, default=100.0)  # 0-100 input quality score
    top_factors = Column(JSON, nullable=False)      # JSON array of structured factor strings
    positive_factors = Column(JSON, nullable=False, default=list) # JSON array of positive signal strings
    risk_factors = Column(JSON, nullable=False, default=list)     # JSON array of risk signal strings
    factor_breakdown = Column(JSON, nullable=True, default=dict)  # Categorized factor details
    analyst_summary = Column(Text, nullable=True)                 # Deterministic AI explanation summary
    model_version = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    assessment = relationship("Assessment", back_populates="prediction")

class Report(Base):
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    report_data = Column(JSON, nullable=False)   # Structured report JSON
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    assessment = relationship("Assessment", back_populates="report")

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)  # Bytes
    mime_type = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    status = Column(String, default="uploaded", nullable=False, index=True)  # legacy status: uploaded | processed | verified | error
    document_type = Column(String, default="OTHER", nullable=False)  # BANK_STATEMENT | GST_DOCUMENT | INVOICE | UTILITY_BILL | PROFIT_LOSS | BALANCE_SHEET | INCOME_STATEMENT | LOAN_STATEMENT | OTHER
    processing_status = Column(String, default="UPLOADED", nullable=False)  # UPLOADED | PROCESSING | EXTRACTED | REVIEW_REQUIRED | VERIFIED | FAILED
    error_message = Column(Text, nullable=True)
    extracted_data = Column(JSON, default=dict, nullable=False)   # Structured key-values summary
    file_hash = Column(String(64), nullable=True, index=True)      # SHA-256 hash for duplicate & integrity tracking
    verification_report = Column(JSON, default=dict, nullable=False) # Verification engine results, discrepancies, fraud indicators
    analyst_decision = Column(String, nullable=True)               # APPROVED | REJECTED | INVESTIGATION_REQUIRED | NEEDS_DOCUMENTS
    analyst_notes = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="documents")
    business = relationship("Business", back_populates="documents")
    fields = relationship("ExtractedField", back_populates="document", cascade="all, delete-orphan", lazy="selectin")

class ExtractedField(Base):
    __tablename__ = "extracted_fields"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    field_name = Column(String, nullable=False, index=True)
    raw_value = Column(Text, nullable=True)
    normalized_value = Column(Float, nullable=True)
    string_value = Column(String, nullable=True)
    confidence = Column(Float, nullable=False, default=0.0)
    source_page = Column(Integer, nullable=True, default=1)
    extraction_method = Column(String, nullable=False, default="native_text")
    is_verified = Column(Boolean, default=False, nullable=False)
    is_manually_edited = Column(Boolean, default=False, nullable=False)
    verified_value = Column(Text, nullable=True)
    verified_by = Column(String, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    document = relationship("Document", back_populates="fields")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, default="info", nullable=False)  # info | warning | success | alert
    is_read = Column(Boolean, default=False, nullable=False)
    link = Column(String, nullable=True)
    related_assessment_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="notifications")

class AlertRule(Base):
    __tablename__ = "alert_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    rule_type = Column(String, nullable=False)  # high_risk_detected | score_threshold | default_spike
    threshold = Column(Float, nullable=False)   # e.g. 50.0 for 50% probability
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="alert_rules")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String, nullable=False, index=True)  # e.g. "CREATE_ASSESSMENT", "SIMULATE_RISK", "EXPORT_REPORT"
    resource_type = Column(String, nullable=False)  # "assessment", "business", "document", "auth"
    resource_id = Column(String, nullable=True)
    details = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")

class IdentityVerification(Base):
    __tablename__ = "identity_verifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    
    id_type = Column(String, nullable=False, index=True)  # PAN | AADHAAR
    masked_id = Column(String, nullable=False)            # e.g. "ABCDE****F" or "XXXX-XXXX-1234"
    id_hash = Column(String(64), nullable=True, index=True) # SHA-256 for duplicate check
    name_on_doc = Column(String, nullable=True)
    dob_or_incorporation = Column(String, nullable=True)
    entity_type = Column(String, nullable=True)           # PROPRIETORSHIP | COMPANY | INDIVIDUAL | PARTNERSHIP
    
    # Informed Consent (Mandatory for Aadhaar processing)
    consent_obtained = Column(Boolean, default=False, nullable=False)
    consent_timestamp = Column(DateTime, nullable=True)
    
    # Unified 6-Stage Check Results
    document_uploaded = Column(Boolean, default=True, nullable=False)
    text_extracted = Column(Boolean, default=False, nullable=False)
    extraction_confidence = Column(Float, default=0.0, nullable=False)
    
    format_valid = Column(Boolean, default=False, nullable=False)
    format_validation_notes = Column(Text, nullable=True)
    
    declared_name_match = Column(Boolean, default=False, nullable=False)
    name_match_score = Column(Float, default=0.0, nullable=False)
    declared_details_match = Column(Boolean, default=False, nullable=False)
    match_breakdown = Column(JSON, default=dict, nullable=False)
    
    external_verification_status = Column(String, default="UNABLE_TO_VERIFY", nullable=False)  # UNABLE_TO_VERIFY | NOT_CONFIGURED | VERIFIED | MISMATCH | PENDING
    external_verification_source = Column(String, nullable=True)
    external_verification_ref = Column(String, nullable=True)
    external_verification_message = Column(Text, nullable=True)
    
    manual_review_status = Column(String, default="PENDING", nullable=False)  # PENDING | COMPLETED_APPROVED | COMPLETED_REJECTED | NOT_REQUIRED
    analyst_decision = Column(String, nullable=True)  # APPROVED | REJECTED | INVESTIGATION_REQUIRED | NEEDS_CLARIFICATION
    analyst_notes = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="identity_verifications")
    business = relationship("Business", back_populates="identity_verifications")
    document = relationship("Document")

class BankAccount(Base):
    __tablename__ = "bank_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True)
    statement_document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    
    bank_name = Column(String, nullable=False, index=True)
    account_number_masked = Column(String, nullable=False)  # e.g. "XXXXXX1234"
    account_type = Column(String, default="CURRENT", nullable=False)  # CURRENT | SAVINGS | CASH_CREDIT | OVERDRAFT
    ifsc_code = Column(String, nullable=True)
    account_holder_name = Column(String, nullable=True)
    is_primary = Column(Boolean, default=False, nullable=False)
    
    reporting_period_start = Column(String, nullable=True)  # YYYY-MM-DD
    reporting_period_end = Column(String, nullable=True)    # YYYY-MM-DD
    verification_status = Column(String, default="UPLOADED", nullable=False) # UPLOADED | PROCESSING | VERIFIED | MISMATCH_FOUND | MANUAL_REVIEW_REQUIRED
    
    extracted_summary = Column(JSON, default=dict, nullable=False)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="bank_accounts")
    business = relationship("Business", back_populates="bank_accounts")
    statement_document = relationship("Document")
    transactions = relationship("BankTransaction", back_populates="bank_account", cascade="all, delete-orphan", lazy="selectin", foreign_keys="[BankTransaction.bank_account_id]")

class BankTransaction(Base):
    __tablename__ = "bank_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    
    transaction_date = Column(String, nullable=False, index=True)  # YYYY-MM-DD
    description = Column(Text, nullable=False)
    reference_no = Column(String, nullable=True)
    
    debit = Column(Float, default=0.0, nullable=False)
    credit = Column(Float, default=0.0, nullable=False)
    balance = Column(Float, nullable=True)
    
    # Category: sales_receipt | own_account_transfer | loan_proceeds | refund | capital_injection | loan_repayment_emi | operating_expense | tax_payment | unknown
    category = Column(String, default="unknown", nullable=False, index=True)
    is_internal_transfer = Column(Boolean, default=False, nullable=False, index=True)
    transfer_confidence = Column(Float, default=0.0, nullable=False)
    matched_account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)
    
    analyst_reviewed = Column(Boolean, default=False, nullable=False)
    analyst_category_override = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    bank_account = relationship("BankAccount", back_populates="transactions", foreign_keys=[bank_account_id])
    matched_account = relationship("BankAccount", foreign_keys=[matched_account_id])
    document = relationship("Document")

class ApplicantCorrection(Base):
    __tablename__ = "applicant_corrections"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    
    field_name = Column(String, nullable=False)  # annual_revenue | existing_debt | business_name | etc.
    original_value = Column(Text, nullable=True)
    corrected_value = Column(Text, nullable=False)
    reason = Column(Text, nullable=False)
    
    replaced_document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    new_document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    
    submitted_by = Column(String, nullable=False)  # User UID or name
    status = Column(String, default="PENDING_REVIEW", nullable=False)  # PENDING_REVIEW | ACCEPTED | REJECTED
    analyst_notes = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    recalculated_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="corrections")
    business = relationship("Business", back_populates="corrections")
    replaced_document = relationship("Document", foreign_keys=[replaced_document_id])
    new_document = relationship("Document", foreign_keys=[new_document_id])

class DocumentExemption(Base):
    __tablename__ = "document_exemptions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True)
    category = Column(String, nullable=False, index=True)  # GST_DOCUMENT | BUSINESS_REGISTRATION | etc.
    reason = Column(Text, nullable=False)
    status = Column(String, default="APPROVED", nullable=False)  # PENDING_REVIEW | APPROVED | REJECTED
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User")
    business = relationship("Business")

class FinancialMetricRecord(Base):
    __tablename__ = "financial_metric_records"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True)
    metric_key = Column(String, nullable=False, index=True)
    metric_name = Column(String, nullable=False)
    calculated_value = Column(Float, nullable=True)
    unit = Column(String, default="INR", nullable=False)
    period_start = Column(String, nullable=True)
    period_end = Column(String, nullable=True)
    formula = Column(Text, nullable=True)
    provenance_type = Column(String, default="CALCULATED", nullable=False)  # CALCULATED | ESTIMATED | EXTRACTED | DECLARED | INDEPENDENTLY_VERIFIED
    data_completeness = Column(String, default="COMPLETE", nullable=False)  # COMPLETE | PARTIAL | INSUFFICIENT
    verification_limitations = Column(Text, nullable=True)
    source_records_summary = Column(JSON, default=dict, nullable=False)
    is_stale = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="financial_metrics")
    business = relationship("Business", back_populates="financial_metrics")

class FinancialDiscrepancy(Base):
    __tablename__ = "financial_discrepancies"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True)
    discrepancy_code = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    severity = Column(String, default="MEDIUM", nullable=False, index=True)  # LOW | MEDIUM | HIGH | CRITICAL
    affected_field = Column(String, nullable=False)
    expected_value = Column(String, nullable=True)
    observed_value = Column(String, nullable=True)
    source_document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    reporting_period = Column(String, nullable=True)
    difference_amount = Column(Float, nullable=True)
    difference_percentage = Column(Float, nullable=True)
    detection_rule = Column(Text, nullable=True)
    explanation = Column(Text, nullable=False)
    verification_status = Column(String, default="OPEN", nullable=False, index=True)  # OPEN | INVESTIGATING | RESOLVED | EXEMPTED | DISMISSED
    analyst_resolution = Column(Text, nullable=True)
    resolved_by = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    user = relationship("User", back_populates="financial_discrepancies")
    business = relationship("Business", back_populates="financial_discrepancies")
    source_document = relationship("Document")

class FinancialAnalysisRun(Base):
    __tablename__ = "financial_analysis_runs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.uid", ondelete="CASCADE"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String, default="COMPLETED", nullable=False, index=True)  # PENDING | PROCESSING | COMPLETED | FAILED
    trigger_source = Column(String, default="MANUAL", nullable=False)  # DOCUMENT_UPLOAD | MANUAL_RECALCULATE | ASSESSMENT_CREATION | CORRECTION
    summary = Column(JSON, default=dict, nullable=False)
    data_quality_score = Column(Float, default=100.0, nullable=False)
    data_quality_breakdown = Column(JSON, default=dict, nullable=False)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    
    user = relationship("User", back_populates="financial_analysis_runs")
    business = relationship("Business", back_populates="financial_analysis_runs")

class TransactionClassificationAudit(Base):
    __tablename__ = "transaction_classification_audits"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("bank_transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    previous_category = Column(String, nullable=False)
    new_category = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    performed_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    transaction = relationship("BankTransaction")


class ModelExplanation(Base):
    __tablename__ = "model_explanations"
    
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    model_version = Column(String, nullable=False, index=True)
    explainer_type = Column(String, default="TreeSHAP", nullable=False)
    output_space = Column(String, default="log-odds", nullable=False)
    baseline_value = Column(Float, nullable=False)
    raw_margin = Column(Float, nullable=False)
    predicted_probability = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False, index=True)
    shap_values = Column(JSON, nullable=False)               # Raw 14 transformed feature contributions
    aggregated_shap_values = Column(JSON, nullable=False)    # Aggregated 11 business feature contributions
    feature_values = Column(JSON, nullable=False)            # Input raw feature dictionary
    waterfall_steps = Column(JSON, nullable=False)           # Ordered steps from baseline to margin
    explanation_status = Column(String, default="AVAILABLE", nullable=False, index=True) # AVAILABLE | PARTIAL | UNAVAILABLE | FAILED
    warnings = Column(JSON, default=list, nullable=False)
    calculation_duration_ms = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    assessment = relationship("Assessment", back_populates="model_explanation")


class GlobalImportanceSnapshot(Base):
    __tablename__ = "global_importance_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    model_version = Column(String, nullable=False, index=True)
    dataset_fingerprint = Column(String, nullable=False, index=True)
    sample_count = Column(Integer, nullable=False)
    feature_importances = Column(JSON, nullable=False)       # List of ranked features with mean_abs_shap and xgboost metrics
    shap_aggregation_method = Column(String, default="mean_absolute", nullable=False)
    is_valid = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)


class CounterfactualSimulation(Base):
    __tablename__ = "counterfactual_simulations"
    
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    model_version = Column(String, nullable=False)
    original_probability = Column(Float, nullable=False)
    original_risk_level = Column(String, nullable=False)
    target_risk_level = Column(String, nullable=False)
    status = Column(String, default="FOUND", nullable=False, index=True)  # FOUND | NO_VALID_CANDIDATE | FAILED
    proposed_changes = Column(JSON, nullable=False)          # Feature change proposals with delta
    counterfactual_probability = Column(Float, nullable=False)
    counterfactual_risk_level = Column(String, nullable=False)
    search_constraints = Column(JSON, nullable=False)
    execution_duration_ms = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    assessment = relationship("Assessment", back_populates="counterfactual_simulations")


class CreditPolicy(Base):
    __tablename__ = "credit_policies"

    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(String, unique=True, nullable=False, index=True)
    version = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    rules = Column(JSON, nullable=False, default=list)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)


class PolicyEvaluation(Base):
    __tablename__ = "policy_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_id = Column(String, nullable=False, index=True)
    policy_version = Column(String, nullable=False)
    overall_status = Column(String, default="PASS", nullable=False, index=True)  # PASS | FAIL | REVIEW_REQUIRED
    passed_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    review_required_count = Column(Integer, default=0, nullable=False)
    rule_results = Column(JSON, nullable=False, default=list)
    evaluated_by = Column(String, nullable=True)
    evaluated_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

    # Relationships
    assessment = relationship("Assessment", back_populates="policy_evaluations")


class CreditReviewRecord(Base):
    __tablename__ = "credit_reviews"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    analyst_id = Column(String, nullable=False, index=True)
    previous_status = Column(String, nullable=True)
    new_status = Column(String, nullable=False, index=True)
    action_type = Column(String, nullable=False, index=True)  # STATUS_CHANGE | NOTE_ADDED | INFO_REQUESTED | ESCALATED | RECOMMENDATION_RECORDED | REVIEW_COMPLETED
    recommendation = Column(String, nullable=True)  # APPROVE | REJECT | REFER | NEEDS_INFO
    reason_code = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    evidence_references = Column(JSON, nullable=True, default=list)
    escalated_to = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

    # Relationships
    assessment = relationship("Assessment", back_populates="credit_reviews")


class DecisionOverride(Base):
    __tablename__ = "decision_overrides"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(String, nullable=False, index=True)
    actor_role = Column(String, nullable=False)
    original_model_output = Column(Float, nullable=False)
    original_risk_band = Column(String, nullable=False)
    final_decision = Column(String, nullable=False)  # APPROVE | REJECT | REFER
    final_risk_band = Column(String, nullable=False)  # LOW | MEDIUM | HIGH
    override_type = Column(String, nullable=False)  # BAND_UPGRADE | BAND_DOWNGRADE | DECISION_OVERRIDE | POLICY_EXCEPTION
    reason_code = Column(String, nullable=False)
    rationale = Column(Text, nullable=False)
    evidence_references = Column(JSON, nullable=True, default=list)
    policy_version = Column(String, nullable=True)
    model_version = Column(String, nullable=False)
    approval_status = Column(String, default="APPROVED", nullable=False, index=True)  # APPROVED | PENDING_SUPERVISOR | REJECTED
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

    # Relationships
    assessment = relationship("Assessment", back_populates="decision_overrides")


class ModelRegistryRecord(Base):
    __tablename__ = "model_registry_records"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(String, nullable=False, index=True)
    model_version = Column(String, unique=True, nullable=False, index=True)
    algorithm = Column(String, nullable=False)
    artifact_fingerprint = Column(String, nullable=False)
    schema_fingerprint = Column(String, nullable=False)
    preprocessing_version = Column(String, nullable=False)
    training_samples = Column(Integer, nullable=False)
    test_samples = Column(Integer, nullable=False)
    validation_metrics = Column(JSON, nullable=False, default=dict)
    feature_schema = Column(JSON, nullable=False, default=dict)
    is_active = Column(Boolean, default=False, nullable=False, index=True)
    deployment_status = Column(String, default="ACTIVE", nullable=False, index=True)  # ACTIVE | CANDIDATE | ARCHIVED | ROLLED_BACK
    known_limitations = Column(JSON, nullable=True, default=list)
    registered_by = Column(String, nullable=True)
    registered_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)


class ModelDriftSnapshot(Base):
    __tablename__ = "model_drift_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    model_version = Column(String, nullable=False, index=True)
    reference_dataset = Column(String, nullable=False)
    observation_count = Column(Integer, nullable=False)
    evaluation_window_days = Column(Integer, default=30, nullable=False)
    overall_drift_status = Column(String, default="NO_DRIFT", nullable=False, index=True)  # NO_DRIFT | MODERATE_DRIFT | SIGNIFICANT_DRIFT | BASELINE_UNAVAILABLE
    mean_psi = Column(Float, nullable=True)
    feature_drift_metrics = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)


class GovernanceAlert(Base):
    __tablename__ = "governance_alerts"

    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String, nullable=False, index=True)  # DRIFT_DETECTED | SCHEMA_MISMATCH | PERFORMANCE_DEGRADATION | VERSION_MISMATCH | EXPLANATION_FAILURE_RATE | POLICY_VIOLATION
    severity = Column(String, default="WARNING", nullable=False, index=True)  # INFO | WARNING | CRITICAL
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    metric_name = Column(String, nullable=True)
    observed_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    model_version = Column(String, nullable=False, index=True)
    status = Column(String, default="OPEN", nullable=False, index=True)  # OPEN | ACKNOWLEDGED | RESOLVED
    acknowledged_by = Column(String, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_by = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)




