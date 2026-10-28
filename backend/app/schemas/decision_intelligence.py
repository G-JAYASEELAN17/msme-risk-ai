from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field


# ==============================================================================
# POLICY RULE ENGINE SCHEMAS
# ==============================================================================

class PolicyRuleDefinition(BaseModel):
    rule_id: str
    name: str
    description: str
    category: str  # DOCUMENTATION | FINANCIAL_COMPLETENESS | DATA_INTEGRITY | UNDERWRITING_THRESHOLDS | VERIFICATION
    severity: str  # INFO | WARNING | CRITICAL
    threshold_value: Optional[Any] = None
    enabled: bool = True


class PolicyRuleResult(BaseModel):
    rule_id: str
    name: str
    category: str
    severity: str
    status: str  # PASS | FAIL | REVIEW_REQUIRED | NOT_APPLICABLE | UNABLE_TO_EVALUATE
    observed_value: Optional[Any] = None
    threshold_value: Optional[Any] = None
    rationale: str
    evidence_references: List[str] = []


class CreditPolicyResponse(BaseModel):
    id: int
    policy_id: str
    version: str
    name: str
    description: Optional[str] = None
    rules: List[PolicyRuleDefinition]
    is_active: bool
    created_by: Optional[str] = None
    created_at: datetime


class CreditPolicyCreateRequest(BaseModel):
    policy_id: str
    version: str
    name: str
    description: Optional[str] = None
    rules: List[PolicyRuleDefinition]
    is_active: bool = True


class PolicyEvaluationResponse(BaseModel):
    id: int
    assessment_id: int
    policy_id: str
    policy_version: str
    overall_status: str  # PASS | FAIL | REVIEW_REQUIRED
    passed_count: int
    failed_count: int
    review_required_count: int
    rule_results: List[PolicyRuleResult]
    evaluated_by: Optional[str] = None
    evaluated_at: datetime


# ==============================================================================
# HUMAN-IN-THE-LOOP REVIEW & OVERRIDE SCHEMAS
# ==============================================================================

class ReviewActionRequest(BaseModel):
    action_type: str  # STATUS_CHANGE | NOTE_ADDED | INFO_REQUESTED | ESCALATED | RECOMMENDATION_RECORDED | REVIEW_COMPLETED
    new_status: str  # READY_FOR_REVIEW | REVIEW_IN_PROGRESS | NEEDS_MORE_INFORMATION | ESCALATED | REVIEW_COMPLETED
    recommendation: Optional[str] = None  # APPROVE | REJECT | REFER | NEEDS_INFO
    reason_code: Optional[str] = None
    notes: Optional[str] = None
    evidence_references: List[str] = []
    escalated_to: Optional[str] = None

HumanReviewActionRequest = ReviewActionRequest


class DecisionOverrideRequest(BaseModel):
    final_decision: str  # APPROVE | REJECT | REFER
    final_risk_band: str  # LOW | MEDIUM | HIGH
    override_type: str  # BAND_UPGRADE | BAND_DOWNGRADE | DECISION_OVERRIDE | POLICY_EXCEPTION
    reason_code: str
    rationale: str
    evidence_references: List[str] = []


class DecisionOverrideResponse(BaseModel):
    id: int
    assessment_id: int
    actor_id: str
    actor_role: str
    original_model_output: float
    original_risk_band: str
    final_decision: str
    final_risk_band: str
    override_type: str
    reason_code: str
    rationale: str
    evidence_references: List[str]
    policy_version: Optional[str]
    model_version: str
    approval_status: str
    created_at: datetime


class CreditReviewItemResponse(BaseModel):
    id: int
    assessment_id: int
    analyst_id: str
    previous_status: Optional[str]
    new_status: str
    action_type: str
    recommendation: Optional[str]
    reason_code: Optional[str]
    notes: Optional[str]
    evidence_references: List[str]
    escalated_to: Optional[str]
    created_at: datetime


# ==============================================================================
# UNIFIED CREDIT ASSESSMENT WORKSPACE SCHEMAS
# ==============================================================================

class EvidenceItem(BaseModel):
    field_name: str
    display_name: str
    declared_value: Optional[Any] = None
    extracted_ocr_value: Optional[Any] = None
    independently_verified_value: Optional[Any] = None
    status: str  # VERIFIED | CONFLICTING | UNVERIFIED | MISSING
    source_document: Optional[str] = None
    confidence: Optional[float] = None
    notes: Optional[str] = None


class EvidenceSummaryResponse(BaseModel):
    applicant_declared: List[Dict[str, Any]]
    document_extracted: List[Dict[str, Any]]
    independently_verified: List[Dict[str, Any]]
    conflicting_unverified: List[EvidenceItem]
    derived_financial_metrics: List[Dict[str, Any]]
    model_generated_outputs: Dict[str, Any]
    human_notes: List[Dict[str, Any]]


class ReviewChecklistItem(BaseModel):
    item_id: str
    label: str
    category: str
    is_completed: bool
    status: str  # SATISFIED | ACTION_REQUIRED | OPTIONAL
    details: Optional[str] = None


class UnifiedWorkspaceResponse(BaseModel):
    assessment_id: int
    business_id: int
    business_name: str
    industry: str
    business_age: int
    employees: int
    created_at: datetime

    # Separate distinct workflow statuses
    model_status: str  # COMPLETED | PENDING | FAILED
    verification_status: str  # VERIFIED | PARTIAL | PENDING | DISCREPANCY_FLAGGED
    policy_status: str  # PASS | FAIL | REVIEW_REQUIRED | NOT_EVALUATED
    human_review_status: str  # SUBMITTED | READY_FOR_REVIEW | REVIEW_IN_PROGRESS | NEEDS_MORE_INFORMATION | ESCALATED | REVIEW_COMPLETED

    # Model inference summary
    model_version: str
    default_probability: float
    risk_level: str
    risk_score: float
    data_completeness_pct: float
    prediction_timestamp: datetime

    # Risk explanation summary (TreeSHAP)
    baseline_value: float
    raw_margin: float
    top_positive_drivers: List[Dict[str, Any]]
    top_negative_drivers: List[Dict[str, Any]]
    explanation_available: bool

    # Evidence, Policy & Checklist
    evidence_summary: EvidenceSummaryResponse
    policy_evaluation: Optional[PolicyEvaluationResponse] = None
    review_checklist: List[ReviewChecklistItem]
    review_history: List[CreditReviewItemResponse]
    overrides: List[DecisionOverrideResponse]
    active_override: Optional[DecisionOverrideResponse] = None

    # Disclaimers
    limitations: List[str]


# ==============================================================================
# MODEL MONITORING & GOVERNANCE SCHEMAS
# ==============================================================================

class FeatureDriftItem(BaseModel):
    feature_name: str
    feature_type: str  # numerical | categorical
    psi_score: Optional[float] = None
    distribution_shift_pct: Optional[float] = None
    baseline_mean: Optional[float] = None
    current_mean: Optional[float] = None
    status: str  # NO_DRIFT | MODERATE_DRIFT | SIGNIFICANT_DRIFT | BASELINE_UNAVAILABLE


class DriftSnapshotResponse(BaseModel):
    id: int
    model_version: str
    reference_dataset: str
    observation_count: int
    evaluation_window_days: int
    overall_drift_status: str
    mean_psi: Optional[float]
    feature_drift_metrics: Dict[str, FeatureDriftItem]
    calculated_at: datetime


class GovernanceAlertResponse(BaseModel):
    id: int
    alert_type: str
    severity: str
    title: str
    description: str
    metric_name: Optional[str]
    observed_value: Optional[float]
    threshold_value: Optional[float]
    model_version: str
    status: str
    acknowledged_by: Optional[str]
    acknowledged_at: Optional[datetime]
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    resolution_notes: Optional[str]
    created_at: datetime


class AlertActionRequest(BaseModel):
    action: str  # ACKNOWLEDGE | RESOLVE
    resolution_notes: Optional[str] = None


class ModelRegistryResponse(BaseModel):
    id: int
    model_id: str
    model_version: str
    algorithm: str
    artifact_fingerprint: str
    schema_fingerprint: str
    preprocessing_version: str
    training_samples: int
    test_samples: int
    validation_metrics: Dict[str, Any]
    feature_schema: Dict[str, Any]
    is_active: bool
    deployment_status: str
    known_limitations: List[str]
    registered_by: Optional[str]
    registered_at: datetime


class GovernanceSummaryResponse(BaseModel):
    active_model: ModelRegistryResponse
    registered_models: List[ModelRegistryResponse]
    drift_summary: Optional[DriftSnapshotResponse]
    open_alerts_count: int
    alerts: List[GovernanceAlertResponse]
    performance_monitoring_status: str
    performance_metrics: Optional[Dict[str, Any]]
    fairness_status: str
    fairness_disclosures: Dict[str, Any]
