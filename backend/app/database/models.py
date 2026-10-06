import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean, Text
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    
    uid = Column(String, primary_key=True, index=True)  # Firebase UID
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    role = Column(String, default="user", nullable=False)  # user | analyst | admin
    settings = Column(JSON, default=dict, nullable=False)  # notification prefs, onboarding status, etc.
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    businesses = relationship("Business", back_populates="owner", cascade="all, delete-orphan", lazy="selectin")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    alert_rules = relationship("AlertRule", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan", lazy="selectin")

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
    review_status = Column(String, default="pending", nullable=False) # pending | in_review | approved | rejected | needs_info
    review_notes = Column(Text, nullable=True)
    additional_comments = Column(Text, nullable=True)
    reviewed_by = Column(String, nullable=True)             # Analyst UID
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    business = relationship("Business", back_populates="assessments")
    prediction = relationship("Prediction", back_populates="assessment", uselist=False, cascade="all, delete-orphan", lazy="selectin")
    report = relationship("Report", back_populates="assessment", uselist=False, cascade="all, delete-orphan", lazy="selectin")

class Prediction(Base):
    __tablename__ = "predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    default_probability = Column(Float, nullable=False)
    risk_level = Column(String, nullable=False)  # LOW / MEDIUM / HIGH
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
    status = Column(String, default="uploaded", nullable=False)  # legacy status: uploaded | processed | verified | error
    document_type = Column(String, default="OTHER", nullable=False)  # BANK_STATEMENT | GST_DOCUMENT | INVOICE | UTILITY_BILL | PROFIT_LOSS | BALANCE_SHEET | INCOME_STATEMENT | LOAN_STATEMENT | OTHER
    processing_status = Column(String, default="UPLOADED", nullable=False)  # UPLOADED | PROCESSING | EXTRACTED | REVIEW_REQUIRED | VERIFIED | FAILED
    error_message = Column(Text, nullable=True)
    extracted_data = Column(JSON, default=dict, nullable=False)   # Structured key-values summary
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
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
    action = Column(String, nullable=False)  # e.g. "CREATE_ASSESSMENT", "SIMULATE_RISK", "EXPORT_REPORT"
    resource_type = Column(String, nullable=False)  # "assessment", "business", "document", "auth"
    resource_id = Column(String, nullable=True)
    details = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
