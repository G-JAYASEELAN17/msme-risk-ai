# AI Credit Decision Intelligence & Model Governance Architecture & Implementation Plan
## MSME Risk AI — Institutional Underwriting & MLOps Governance Platform

**Document Status:** Approved Architecture Plan  
**Target Architecture:** React 18 + Vite + TypeScript (Frontend), FastAPI + Python 3.11 (Backend), PostgreSQL / Supabase (Alembic), XGBoost 2.0.3 / TreeSHAP  
**Design Theme:** Midnight + Violet (`#0C0A1D`, `#1C1933`, `#8B5CF6`, `#F5F3FF`, `#B7B1D1`, `#252141`, `#30294D`, `#383154`)  
**Date:** 2026-10-22  

---

## 1. Executive Summary & Existing System Audit

The **MSME Risk AI** platform currently provides automated credit risk prediction, document intelligence, financial discrepancy audits, multi-bank statement analysis, and Advanced Explainable AI (TreeSHAP waterfall attributions, constrained counterfactuals, and stability diagnostics). 

This plan details the upgrade to a complete **AI Credit Decision Intelligence & Model Governance** module. The module connects disparate underwriting evidence into a structured, auditable assessment workflow and establishes institutional model governance controls without altering the underlying XGBoost model, weakening security, or automating credit determinations.

### A. Current Operational Baseline (Verified)
1. **Machine Learning Inference Pipeline:**
   - Model artifact: `backend/ml/saved_models/model.joblib` (XGBClassifier v1.1.0, binary default risk).
   - Preprocessing artifact: `backend/ml/saved_models/scaler.joblib` (`ColumnTransformer` with `StandardScaler` for 10 numerical features and `OneHotEncoder` for `industry`, producing 14 transformed columns).
   - Active feature schema: 11 business features (`age`, `employees`, `annual_revenue`, `monthly_cash_flow`, `monthly_expenses`, `existing_debt`, `digital_transactions`, `utility_payment_score`, `invoice_payment_score`, `previous_defaults`, `industry`).
   - Ground truth / evaluation baseline: `data/processed/msme_loans_clean.csv` (2,501 rows total; 500 stratified holdout test samples with documented metrics: ROC-AUC 0.9647, Accuracy 0.918, F1 0.800).
2. **Explainable AI Pipeline:**
   - TreeSHAP engine: Margin log-odds decomposition with exact additivity ($|\text{baseline} + \sum \text{SHAP} - \text{margin}| < 10^{-6}$).
   - Persistence tables: `model_explanations`, `global_importance_snapshots`, `counterfactual_simulations`.
   - Stability diagnostics: 10 bounded perturbations ($\pm 5\%$ to $\pm 8\%$) measuring risk band retention and top-3 SHAP stability.
3. **Authentication, RBAC & Isolation:**
   - Firebase JWT bearer verification in `backend/app/auth.py`.
   - Roles: `user` (borrower/applicant), `analyst` (credit underwriter), `admin` (compliance and platform administrator).
   - Status gates: `pending_email_verification`, `pending_admin_approval`, `approved`, `suspended`, `rejected`.
   - Tenant isolation: Multi-tenant ownership checks (`assessment.business.user_id == current_user.uid`), blocking IDOR access.
4. **Existing Frontend Capabilities:**
   - `AssessmentReview.tsx`: Comprehensive analyst portal loading assessment, OCR extracted fields, bank analysis, identity status, and basic review actions.
   - `Explainability.tsx`: Local TreeSHAP waterfall, positive/negative risk drivers, constrained counterfactuals, what-if simulator, global feature importance, and stability diagnostics.
   - `ModelMonitoring.tsx` & `ModelCard.tsx`: Basic administrative model metadata and prediction counts.

---

## 2. Identified Gaps & Architectural Objectives

| Domain | Current State | Required Upgrade |
| :--- | :--- | :--- |
| **Unified Workspace** | Information is scattered across `AssessmentReview`, `Explainability`, `FinancialIntelligence`, and `Documents`. | A consolidated **Credit Decision Workspace** with clear provenance separation (declared vs. OCR vs. verified vs. derived vs. model output vs. notes). |
| **Policy Engine** | Hardcoded checks in document checklists and ad-hoc review checks. | A standalone, versioned, auditable **Policy Rule Engine** with standardized statuses (`PASS`, `FAIL`, `REVIEW_REQUIRED`, `NOT_APPLICABLE`, `UNABLE_TO_EVALUATE`). |
| **Workflow State Machine** | Only `review_status` on Assessment table (`pending`, `in_review`, `approved`, `rejected`, `needs_info`). | Independent status separation: Model Status, Verification Status, Policy Status, Human Review Status (`SUBMITTED`, `PROCESSING`, `READY_FOR_REVIEW`, `REVIEW_IN_PROGRESS`, `NEEDS_MORE_INFORMATION`, `ESCALATED`, `REVIEW_COMPLETED`). |
| **Overrides & Governance** | Analyst notes update assessment columns directly; overrides are not isolated from model outputs. | Dedicated `decision_overrides` entity preserving original model output, original risk band, reason codes, written rationale, policy version, and approval state. |
| **Model Drift** | Displays `Baseline statistics unavailable.` | Compute Population Stability Index (PSI) and distributional shift using genuine reference data from `msme_loans_clean.csv`. |
| **Performance Monitoring** | Training summary metrics displayed. | Separate historical training metrics from live production performance. State `PERFORMANCE_MONITORING_UNAVAILABLE` when matured ground-truth default outcomes are not yet linked to historical predictions. |
| **Persistent Alerts** | Ephemeral or UI-only alerts. | Database-backed `governance_alerts` table tracking alert type, severity, metric value, threshold, and status (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`). |
| **Model Registry** | Static JSON file (`model_metadata.json`). | Database-backed `model_registry` tracking version, artifact hash, schema fingerprint, validation metadata, active state, and deployment safeguards. |
| **Fairness & Responsible Use** | Static text disclosures. | Responsible AI governance section detailing lawful demographic limitations (RBI guidelines; non-collection of protected attributes), reporting `NOT_EVALUATED` with explicit justification. |
| **Reporting & Exports** | Basic assessment PDF export. | Comprehensive Credit Assessment Review Report export (JSON/CSV/PDF-ready summary) including evidence provenance, policy evaluation, analyst notes, overrides, and epistemic limitations. |

---

## 3. Detailed Technical Architecture

### A. Database Schema Extensions (Alembic Migration `i1a2b3c4d5e6`)
New tables added to `backend/app/database/models.py`:
1. `credit_policies`:
   - `id`: Integer PK
   - `policy_id`: String (e.g., `CP-STANDARD-V1`), unique, index
   - `version`: String (e.g., `1.0.0`)
   - `name`: String
   - `description`: Text
   - `rules`: JSON (Array of rule definitions: id, category, severity, conditions, threshold)
   - `is_active`: Boolean, index
   - `created_by`: String (Admin UID)
   - `created_at`: DateTime
2. `policy_evaluations`:
   - `id`: Integer PK
   - `assessment_id`: Integer FK (`assessments.id`, ondelete=CASCADE), index
   - `policy_id`: String, index
   - `policy_version`: String
   - `overall_status`: String (`PASS`, `FAIL`, `REVIEW_REQUIRED`), index
   - `passed_count`: Integer
   - `failed_count`: Integer
   - `review_required_count`: Integer
   - `rule_results`: JSON (Array of evaluated rule outcomes, status, evidence refs)
   - `evaluated_by`: String
   - `evaluated_at`: DateTime, index
3. `credit_reviews`:
   - `id`: Integer PK
   - `assessment_id`: Integer FK (`assessments.id`, ondelete=CASCADE), index
   - `analyst_id`: String, index
   - `previous_status`: String
   - `new_status`: String, index
   - `action_type`: String (`STATUS_CHANGE`, `NOTE_ADDED`, `INFO_REQUESTED`, `ESCALATED`, `RECOMMENDATION_RECORDED`, `REVIEW_COMPLETED`)
   - `recommendation`: String (`APPROVE`, `REJECT`, `REFER`, `NEEDS_INFO`)
   - `reason_code`: String
   - `notes`: Text
   - `evidence_references`: JSON
   - `escalated_to`: String
   - `created_at`: DateTime, index
4. `decision_overrides`:
   - `id`: Integer PK
   - `assessment_id`: Integer FK (`assessments.id`, ondelete=CASCADE), index
   - `actor_id`: String, index
   - `actor_role`: String
   - `original_model_output`: Float
   - `original_risk_band`: String
   - `final_decision`: String
   - `final_risk_band`: String
   - `override_type`: String (`BAND_UPGRADE`, `BAND_DOWNGRADE`, `DECISION_OVERRIDE`, `POLICY_EXCEPTION`)
   - `reason_code`: String
   - `rationale`: Text
   - `evidence_references`: JSON
   - `policy_version`: String
   - `model_version`: String
   - `approval_status`: String (`PENDING`, `APPROVED`, `REJECTED`)
   - `created_at`: DateTime, index
5. `model_registry_records`:
   - `id`: Integer PK
   - `model_id`: String, index
   - `model_version`: String, unique, index
   - `algorithm`: String
   - `artifact_fingerprint`: String
   - `schema_fingerprint`: String
   - `preprocessing_version`: String
   - `training_samples`: Integer
   - `test_samples`: Integer
   - `validation_metrics`: JSON
   - `feature_schema`: JSON
   - `is_active`: Boolean, index
   - `deployment_status`: String (`ACTIVE`, `CANDIDATE`, `ARCHIVED`, `ROLLED_BACK`)
   - `known_limitations`: JSON
   - `registered_by`: String
   - `registered_at`: DateTime, index
6. `model_drift_snapshots`:
   - `id`: Integer PK
   - `model_version`: String, index
   - `reference_dataset`: String
   - `observation_count`: Integer
   - `evaluation_window_days`: Integer
   - `overall_drift_status`: String (`NO_DRIFT`, `MODERATE_DRIFT`, `SIGNIFICANT_DRIFT`, `BASELINE_UNAVAILABLE`), index
   - `mean_psi`: Float
   - `feature_drift_metrics`: JSON
   - `created_at`: DateTime, index
7. `governance_alerts`:
   - `id`: Integer PK
   - `alert_type`: String, index (`DRIFT_DETECTED`, `SCHEMA_MISMATCH`, `PERFORMANCE_DEGRADATION`, `VERSION_MISMATCH`, `EXPLANATION_FAILURE_RATE`, `POLICY_VIOLATION`)
   - `severity`: String, index (`INFO`, `WARNING`, `CRITICAL`)
   - `title`: String
   - `description`: Text
   - `metric_name`: String
   - `observed_value`: Float
   - `threshold_value`: Float
   - `model_version`: String, index
   - `status`: String, index (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`)
   - `acknowledged_by`: String
   - `acknowledged_at`: DateTime
   - `resolved_by`: String
   - `resolved_at`: DateTime
   - `resolution_notes`: Text
   - `created_at`: DateTime, index

---

### B. Policy Rule Engine Architecture
A dedicated service `backend/app/services/policy_engine_service.py`:
- **Default Policy Configuration:** Standard Institutional MSME Underwriting Policy (Version `1.0.0`):
  1. `RULE_DOC_PAN`: Mandatory applicant PAN verification.
  2. `RULE_DOC_BANK`: Minimum 6 months operational bank statements uploaded.
  3. `RULE_REV_MIN`: Minimum annual turnover of ₹5,00,000 for standard commercial lending.
  4. `RULE_LEVERAGE_MAX`: Maximum Debt-to-Revenue ratio $\le 4.0\times$.
  5. `RULE_CASH_FLOW_BUFFER`: Monthly net cash flow $\ge 15\%$ of monthly expenditure.
  6. `RULE_NO_UNRESOLVED_CRITICAL_DISCREPANCY`: Zero unresolved severe revenue/debt discrepancies between OCR bank statements and declared figures.
  7. `RULE_DEFAULT_HISTORY`: Prior contractual debt defaults count $\le 1$.
  8. `RULE_HIGH_RISK_MANUAL_REVIEW`: Any applicant with model default probability $\ge 55.0\%$ must undergo senior underwriter escalation.
- **Rule Outcomes:**
  - `PASS`: Condition strictly satisfied.
  - `FAIL`: Violation of policy threshold.
  - `REVIEW_REQUIRED`: Discrepancy or parameter requiring human underwriter sign-off.
  - `NOT_APPLICABLE`: Rule condition inapplicable to current entity category.
  - `UNABLE_TO_EVALUATE`: Missing critical documentation or telemetric signals.
- **Safety Rule:** Missing evidence is never equated with fraud or automated rejection.

---

### C. Input Data Drift Service (PSI Calculation)
A statistical drift engine in `backend/app/services/drift_service.py`:
1. **Reference Baseline:** Loads `data/processed/msme_loans_clean.csv`. For each continuous feature, creates 10 quantile bins and records expected bin frequencies.
2. **Current Production Window:** Extracts the last $N$ assessments (default 30-day window or 200 records).
3. **Population Stability Index (PSI):**
   $$\text{PSI} = \sum_{b=1}^{10} (A_b - E_b) \times \ln\left(\frac{A_b + \epsilon}{E_b + \epsilon}\right)$$
   - $\text{PSI} < 0.10$: `NO_DRIFT` (Stable distribution)
   - $0.10 \le \text{PSI} < 0.25$: `MODERATE_DRIFT` (Slight distribution shift)
   - $\text{PSI} \ge 0.25$: `SIGNIFICANT_DRIFT` (Material distribution shift; triggers WARNING/CRITICAL alert)
4. **Categorical Features (`industry`):** Calculates proportional deviation and frequency shifts.
5. **Fallback:** If `msme_loans_clean.csv` is missing, returns `BASELINE_UNAVAILABLE` without fabricating drift scores.

---

### D. Human-In-The-Loop Workflow & Overrides
In `backend/app/routes/decision_intelligence.py`:
- **Workflow State Machine:**
  $$\text{SUBMITTED} \longrightarrow \text{PROCESSING} \longrightarrow \text{READY\_FOR\_REVIEW} \longleftrightarrow \text{REVIEW\_IN\_PROGRESS} \longleftrightarrow \text{NEEDS\_MORE\_INFORMATION}$$
  $$\text{REVIEW\_IN\_PROGRESS} \longrightarrow \text{ESCALATED} \longrightarrow \text{REVIEW\_COMPLETED}$$
- **Separate Status Model:**
  - `model_status`: `COMPLETED` | `PENDING` | `FAILED`
  - `verification_status`: `VERIFIED` | `PARTIAL` | `PENDING` | `DISCREPANCY_FLAGGED`
  - `policy_status`: `PASS` | `FAIL` | `REVIEW_REQUIRED` | `NOT_EVALUATED`
  - `human_review_status`: `READY_FOR_REVIEW` | `IN_REVIEW` | `APPROVED` | `REJECTED` | `ESCALATED`
- **Override Audit Trail:**
  When an analyst recommends a risk band or decision that differs from the XGBoost model's raw threshold:
  - Original model probability and risk band are immutably preserved.
  - Final human outcome is recorded in `decision_overrides`.
  - Required fields: Structured reason code (e.g., `DOCUMENTED_OFF_BALANCE_SHEET_COLLATERAL`, `SUBSTANTIATED_GST_SEASONALITY`, `ESTABLISHED_VENDOR_LINE`), written rationale, evidence references, actor UID, and role.

---

### E. Frontend Design System (Midnight + Violet)
All new components and views strictly follow the existing tokens:
- Background: `#0C0A1D`
- Cards & Modals: `#1C1933` with `#383154` borders
- Accents & Highlights: `#8B5CF6` (primary), `#A78BFA` (light hover), `#7C3AED` (active)
- Text: `#F5F3FF` (headings, primary text), `#B7B1D1` (muted metadata, table headers)
- Status Colors: Emerald `#22C55E` (Pass/Low), Amber `#F59E0B` (Review/Medium), Rose `#F87171` (Fail/High), Sky `#60A5FA` (Info)

---

## 4. Phased Implementation Roadmap

1. **Phase 1: Architecture & Plan Documentation** (Completed in `docs/CREDIT_DECISION_INTELLIGENCE_PLAN.md`).
2. **Phase 2: Database Schema & Migration** (Define models and create migration `i1a2b3c4d5e6`).
3. **Phase 3: Core Backend Services** (`policy_engine_service.py`, `drift_service.py`, `governance_service.py`, `decision_workspace_service.py`).
4. **Phase 4: API Endpoints & Schemas** (`/api/decision-intelligence/*`, `/api/governance/*`).
5. **Phase 5: Frontend Credit Decision Workspace & Model Governance UI** (Upgrade `AssessmentReview.tsx`, `ModelMonitoring.tsx`, add Policy Management and Decision Workspace).
6. **Phase 6: Automated Testing & Verification** (Backend tests, API integration tests, drift tests, frontend typecheck, and production build).
7. **Phase 7: Final Report & Verification Evidence**.
