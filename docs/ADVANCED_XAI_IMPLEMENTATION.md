# Advanced Explainable AI (XAI) Implementation Specification
## MSME Risk AI — Credit Risk Assessment & Decision-Support Engine

**Document Status:** Approved for Implementation  
**Target Environment:** React 18 + Vite + TypeScript (Frontend), FastAPI + Python 3.11 (Backend), PostgreSQL / Supabase, XGBoost 1.1.0, TreeSHAP 0.51.0  
**Design Theme:** Midnight + Violet (`#0C0A1D`, `#1C1933`, `#8B5CF6`, `#22C55E`, `#F87171`)  

---

## 1. Existing Architecture Discovered

### A. Backend Architecture
- **Framework:** FastAPI with Uvicorn, structured into routes (`backend/app/routes/`), business services (`backend/app/services/`), Pydantic schemas (`backend/app/schemas/`), and SQLAlchemy ORM models (`backend/app/database/models.py`).
- **Database:** Supabase PostgreSQL with pooled connections (`psycopg2`), managed via Alembic migrations (`backend/alembic/versions/`).
- **Authentication & RBAC:** Firebase Auth (`backend/app/auth.py`), verifying RS256 JWT tokens. Enforces role hierarchy (`user`, `analyst`, `admin`) with `approval_status` checks and strict multi-tenant IDOR isolation.
- **ML Inference Stack:**
  - `model.joblib`: Trained `xgboost.sklearn.XGBClassifier` (binary classifier: 0 = non-default, 1 = default).
  - `scaler.joblib`: Scikit-learn `ColumnTransformer` with `StandardScaler` for 10 numerical columns and `OneHotEncoder` for 1 categorical column (`industry`), generating 14 transformed features.
  - `model_metadata.json`: Model version `1.1.0`, ROC-AUC `0.9647`, accuracy `0.918`, precision `0.781`, recall `0.820`, test samples `500`, training samples `2500`.

### B. Frontend Architecture
- **Framework:** React 18 + TypeScript + Vite, Tailwind CSS with customized Midnight + Violet tokens (`#0C0A1D`, `#1C1933`, `#8B5CF6`, `#22C55E`, `#F87171`, `#383154`).
- **State & Query Management:** `@tanstack/react-query` with centralized query caching, React Context for Firebase Auth & RBAC (`AuthRoleContext.tsx`).
- **Navigation & Guarding:** `react-router-dom` with `PrivateRoute` and `RoleRoute` guards enforcing role-based permissions client-side (backed by server-side verification).
- **Visualization:** Native SVG/Canvas and Chart components styled consistently with the Midnight + Violet design system.

---

## 2. Existing Model & Explanation Capabilities Verified

### A. Verified Model Schema & Pipeline
1. **Raw Features (11 features):**
   - Numerical (10): `age` (years), `employees` (count), `annual_revenue` (currency), `monthly_cash_flow` (currency), `monthly_expenses` (currency), `existing_debt` (currency), `digital_transactions` (monthly count), `utility_payment_score` (0–100), `invoice_payment_score` (0–100), `previous_defaults` (count).
   - Categorical (1): `industry` (`Logistics`, `Manufacturing`, `Retail`, `Services`).
2. **Transformed Features (14 columns):**
   - `num__age`, `num__employees`, `num__annual_revenue`, `num__monthly_cash_flow`, `num__monthly_expenses`, `num__existing_debt`, `num__digital_transactions`, `num__utility_payment_score`, `num__invoice_payment_score`, `num__previous_defaults`.
   - `cat__industry_Logistics`, `cat__industry_Manufacturing`, `cat__industry_Retail`, `cat__industry_Services`.
3. **TreeSHAP Properties:**
   - Explainer: `shap.TreeExplainer(model)` and native XGBoost booster `predict(dmatrix, pred_contribs=True)`.
   - Output space: **Log-odds (raw margin)**.
   - Base value (expected value): `0.00022601988`.
   - Additivity: $\text{Base Value} + \sum_{i=1}^{14} \text{SHAP}_i = \text{Raw Margin}$.
   - Probability mapping: $P(\text{Default}) = \sigma(\text{Raw Margin}) = \frac{1}{1 + e^{-\text{Raw Margin}}}$.
   - Discrepancy tolerance: Floating-point precision ($\Delta < 10^{-5}$).

---

## 3. Implementation Plan

### Phase 1 — Database Layer (Schema & Migration)
Extend `backend/app/database/models.py` and create Alembic migration `h1a2b3c4d5e6_add_advanced_xai_tables.py`:
1. `model_explanations`: Stores local TreeSHAP explanations per assessment, signed feature contributions, baseline value, margin, probability, explanation status, and warnings.
2. `global_importance_snapshots`: Stores global mean absolute SHAP feature rankings, evaluation dataset fingerprint, sample size, and cache expiration.
3. `counterfactual_simulations`: Stores generated counterfactual scenarios, proposed feature changes, resulting model predictions, applied constraints, and execution status.

### Phase 2 — Backend Explainability Service
Implement `backend/app/services/explainability_service.py`:
1. **Feature Description Registry:** 11-feature mapping with human-readable labels, units, business descriptions, safe interpretation templates, and directionality.
2. **Local Explanation Generator (`get_or_create_local_explanation`):**
   - Calculates native TreeSHAP values for the 14 transformed features and aggregates industry dummy variables into the parent `industry` feature.
   - Generates step-by-step waterfall steps: `base_value` $\to$ feature contributions $\to$ final `output_margin` $\to$ `default_probability`.
   - Flags discrepancies, out-of-range inputs, or version mismatches.
3. **Global Explainability Engine (`get_global_importance`):**
   - Computes mean absolute SHAP values across evaluation samples or historical assessments.
   - Computes XGBoost built-in Gain and Weight feature importances for side-by-side comparison.
   - Employs cache invalidation based on `model_version` and dataset fingerprint.
4. **Constrained Counterfactual Service (`generate_counterfactuals`):**
   - Actionable features: `existing_debt`, `annual_revenue`, `monthly_cash_flow`, `monthly_expenses`, `digital_transactions`, `utility_payment_score`, `invoice_payment_score`, `previous_defaults`.
   - Immutable features: `age` (business age), `industry` (structural entity classification).
   - Bounded optimization finding minimal perturbations that shift risk band (e.g. HIGH $\to$ MEDIUM $\to$ LOW) under realistic financial constraints.
5. **What-If Recalculation Service (`simulate_what_if`):**
   - Recalculates genuine model predictions and recomputes actual TreeSHAP values for modified inputs.
   - Never overwrites the original assessment; maintains simulation isolation.
6. **Explanation Stability Evaluator (`evaluate_stability`):**
   - Systematic Gaussian and uniform bounded perturbations on actionable inputs ($\pm 5\%$).
   - Evaluates risk band flip frequency and top-3 SHAP feature rank consistency.

### Phase 3 — Backend API Routes & Schemas
1. `backend/app/schemas/explainability.py`: Strict Pydantic v2 schemas for all requests and responses.
2. `backend/app/routes/explainability.py`:
   - `GET /api/explainability/assessments/{assessment_id}`
   - `GET /api/explainability/assessments/{assessment_id}/shap`
   - `GET /api/explainability/global`
   - `POST /api/explainability/assessments/{assessment_id}/counterfactuals`
   - `POST /api/explainability/assessments/{assessment_id}/what-if`
   - `POST /api/explainability/assessments/{assessment_id}/stability`
   - `GET /api/explainability/models/{model_version}/metadata`
3. Register router in `backend/app/main.py`.

### Phase 4 — Frontend Advanced XAI Experience
1. API client expansion in `frontend/src/services/api.ts`.
2. Dedicated `ExplainabilityPage` (`frontend/src/pages/Explainability.tsx`):
   - **Prediction Summary Card:** Output margin, baseline, model probability, risk band, model version, status.
   - **Interactive SHAP Waterfall Plot:** Visualizes additive step-by-step progression from base value to final prediction.
   - **Signed Feature Contribution Bar Chart:** Visualizes positive (risk-increasing) and negative (risk-mitigating) drivers.
   - **Ranked Business Factor Table:** Human-readable explanations, feature values, units, and non-causal descriptions.
   - **Constrained Counterfactual Explorer:** Displays actionable scenarios showing exact proposed changes and predicted risk band outcomes.
   - **Interactive What-If Playground:** Permitted feature adjustments with real-time SHAP recalculation and delta tracking.
   - **Global Model Diagnostics Tab:** Mean absolute SHAP vs XGBoost built-in importance, evaluation dataset provenance.
   - **Explanation Stability & Robustness Card:** Perturbation robustness percentage and top-feature stability score.
   - **Limitations & Governance Notice:** Explicit disclosures regarding what SHAP establishes, causality limits, and model version lineage.
3. Link from `Prediction.tsx`, `AssessmentReview.tsx`, and sidebar navigation.

### Phase 5 — Automated Verification & Regression Testing
- Backend tests in `backend/tests/test_advanced_xai.py`.
- Regression test of existing 100 backend tests.
- Frontend TypeScript typechecking (`npm run typecheck`) and build (`npm run build`).

---

## 4. Files and Database Objects to be Changed

### A. Database Objects
- `model_explanations` (Table)
- `global_importance_snapshots` (Table)
- `counterfactual_simulations` (Table)
- Indexes on `assessment_id`, `model_version`, `created_at`.

### B. Backend Files
- `backend/app/database/models.py`: Model declarations and relationships.
- `backend/alembic/versions/h1a2b3c4d5e6_add_advanced_xai_tables.py`: Migration script.
- `backend/app/services/preprocessing.py`: Imputer unpickling compatibility resilience.
- `backend/app/schemas/explainability.py`: Schemas for XAI requests/responses.
- `backend/app/services/explainability_service.py`: Core TreeSHAP, global importance, counterfactuals, what-if, and stability engine.
- `backend/app/routes/explainability.py`: Endpoints with RBAC & IDOR checks.
- `backend/app/main.py`: Route mounting and rate limiting configuration.
- `backend/tests/test_advanced_xai.py`: Exhaustive automated test suite.

### C. Frontend Files
- `frontend/src/services/api.ts`: Explainability client methods and TypeScript interfaces.
- `frontend/src/pages/Explainability.tsx`: Comprehensive XAI portal.
- `frontend/src/pages/Prediction.tsx`: Deep links to full explainability breakdown.
- `frontend/src/pages/AssessmentReview.tsx`: Analyst XAI inspection integration.
- `frontend/src/App.tsx`: Route configuration (`/explainability`, `/explainability/:id`).
- `frontend/src/components/Sidebar.tsx`: Navigation item for Explainability.

---

## 5. Security, Privacy & Governance Considerations
1. **Multi-Tenant Authorization & IDOR Protection:** Users can only view explanations and run simulations for assessments owned by their account. Analysts and admins can access portfolio assessments for underwriting review.
2. **Server-Side Enforcement:** RBAC is enforced in FastAPI route dependencies; frontend role checks are purely for UX.
3. **Data Minimization:** No raw PII or unencrypted documents are stored in explanation records or logs.
4. **Audit Logging:** Every explanation request, counterfactual generation, and what-if simulation creates an audit log entry.
5. **Epistemic Honesty:**
   - Model predictions are explicitly labeled as model-estimated default probabilities, not calibrated ground truth.
   - Explanations are explicitly labeled as associative feature contributions in log-odds margin space, not proof of causality or guarantees of loan approval.
   - Counterfactuals are labeled as hypothetical optimization scenarios.

---

## 6. Acceptance Criteria
1. TreeSHAP additive equality holds: $|\text{Base Value} + \sum \text{SHAP} - \text{Raw Margin}| < 10^{-4}$.
2. Global feature importance distinguishes mean absolute SHAP from XGBoost split/gain importance.
3. Counterfactual generator respects immutable boundaries (`age`, `industry`) and financial bounds ($\ge 0$).
4. What-If simulations recompute genuine model predictions and SHAP values without mutating original assessment records.
5. All 100 existing backend tests pass without regressions; new XAI tests pass 100%.
6. Frontend compiles cleanly with 0 TypeScript errors and renders the Midnight + Violet theme.
