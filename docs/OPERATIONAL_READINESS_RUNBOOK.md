# MSME Risk AI — Operational Readiness & Database Runbook

## 1. System Overview

MSME Risk AI is an AI-assisted credit assessment and decision-support platform designed for Indian Micro, Small, and Medium Enterprises. The architecture integrates:
- **Frontend**: React 18, Vite, TypeScript, TailwindCSS (Midnight + Violet theme).
- **Backend**: FastAPI (Python 3.11), SQLAlchemy 2.0, Pydantic v2.
- **ML / XAI**: XGBoost 1.1.0 classifier, scikit-learn preprocessing pipeline, TreeSHAP explainability engine.
- **Database**: PostgreSQL (managed via Supabase or local PostgreSQL), Alembic migration engine.
- **Security**: Firebase Authentication, Authoritative RBAC (`user`, `analyst`, `admin`), Ownership / IDOR verification.

---

## 2. Environment Configuration

### Backend Environment (`backend/.env`)

The backend loads configuration from `backend/.env`. Example template:

```env
APP_ENV=production
DEBUG=false
PROJECT_NAME="MSME Risk AI API"
API_V1_STR=/api

# Database Configuration (Supabase PostgreSQL or Local)
# Direct connection (port 5432): postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
# Pooler connection (port 6543 / 5432): postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require

# CORS Configuration
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000","http://127.0.0.1:5173","http://127.0.0.1:3000"]

# Firebase Authentication
FIREBASE_PROJECT_ID=msme-risk-ai
FIREBASE_CREDENTIALS_PATH=backend/secrets/firebase-service-account.json

# Storage & ML Pipeline
MODEL_VERSION=1.1.0
SEED_DEMO_DATA=false
ALLOW_TEST_AUTH=false
```

### Frontend Environment (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000/api
VITE_FIREBASE_API_KEY=[FIREBASE-API-KEY]
VITE_FIREBASE_AUTH_DOMAIN=msme-risk-ai.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=msme-risk-ai
VITE_FIREBASE_STORAGE_BUCKET=msme-risk-ai.appspot.com
```

---

## 3. Startup & Service Execution

### Backend API Server

Use the backend virtual environment at `backend\venv`:

```powershell
# Navigate to backend directory
cd backend

# Start FastAPI server via Uvicorn
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify service is responding:
```powershell
curl http://localhost:8000/health
```

### Frontend Client

```powershell
# Navigate to frontend directory
cd frontend

# Start Vite development server
npm run dev
```

Frontend application will be accessible at: `http://localhost:5173`.

---

## 4. Database Diagnostics & Health Probes

The backend provides structured, non-leaking diagnostic endpoints that never expose passwords, tokens, or credentials in responses:

### A. Liveness Probe (`GET /health` and `GET /api/health`)
Checks if the application process is running and inspects database connectivity:
```json
{
  "status": "healthy",
  "application": "healthy",
  "database": "healthy",
  "database_type": "postgresql",
  "latency_ms": 12.4,
  "environment": "production",
  "version": "1.1.0"
}
```
*If database is down*, returns `"status": "degraded"`, `"database": "unavailable"`, and a sanitized `failure_category` (e.g. `TENANT_OR_USER_NOT_FOUND`, `DNS_RESOLUTION_FAILURE`, `AUTHENTICATION_FAILURE`).

### B. Readiness Probe (`GET /ready` and `GET /api/ready`)
Designed for container orchestrators (Render, Railway, Kubernetes):
- Returns **HTTP 200 OK** when both database and ML model are ready.
- Returns **HTTP 503 Service Unavailable** when the database or critical model dependencies cannot be reached.

### C. Admin System Diagnostics (`GET /api/admin/system/database-diagnostics`)
Protected by admin RBAC token. Returns sanitized target host, port, dialect, driver, latency, and Alembic target head.

---

## 5. Alembic Database Migrations

The repository maintains a strict single-head linear migration graph ending at revision `i1a2b3c4d5e6`.

### Migration Chain
```
<base> -> 1a2b3c4d5e6f (initial_schema)
       -> 83a5875d59d9 (add_analyst_review_workflow_fields)
       -> d7e8f9a0b1c2 (add_document_intelligence_and_extracted_fields)
       -> e8f9a0b1c2d3 (add_risk_intelligence_prediction_fields)
       -> f9a0b1c2d3e4 (add_performance_indexes)
       -> a1b2c3d4e5f6 (add_analyst_approval_and_verification_fields)
       -> g1a2b3c4d5e6 (add_financial_intelligence_tables)
       -> h1a2b3c4d5e6 (add_advanced_xai_tables)
       -> i1a2b3c4d5e6 (add_credit_decision_intelligence_tables) [HEAD]
```

### Inspect Migration Heads and History
```powershell
# From project root:
.\backend\venv\Scripts\python.exe -m alembic heads
.\backend\venv\Scripts\python.exe -m alembic history
```

### Offline SQL Generation (Dry-Run Verification)
Verify full DDL generation without executing against the database:
```powershell
.\backend\venv\Scripts\python.exe -m alembic upgrade base:head --sql
```

### Apply Migrations to Remote Database
Only run when valid credentials and active Supabase project are verified:
```powershell
.\backend\venv\Scripts\python.exe -m alembic upgrade head
```

---

## 6. Model Artifact Verification

The XGBoost model artifact and preprocessing pipeline reside in `backend/ml/models/`:
- `model.joblib`: Trained XGBoost 1.1.0 classifier.
- `scaler.joblib`: scikit-learn `ColumnTransformer` (StandardScaler + OneHotEncoder).
- `model_metadata.json`: Hyperparameters, validation metrics, and feature schemas.

Verify artifact integrity:
```powershell
.\backend\venv\Scripts\python.exe -c "
import joblib, json
model = joblib.load('backend/ml/models/model.joblib')
scaler = joblib.load('backend/ml/models/scaler.joblib')
with open('backend/ml/models/model_metadata.json') as f:
    meta = json.load(f)
print('Model loaded successfully. Version:', meta.get('model_version'))
print('Number of estimators:', getattr(model, 'n_estimators', None))
"
```

---

## 7. Automated Test Commands

### Backend Tests (pytest)
Runs 146 unit, integration, and security tests:
```powershell
.\backend\venv\Scripts\python.exe -m pytest
```

### Frontend Typechecking & Production Build
```powershell
cd frontend
npm run build
```

### Frontend Linter
```powershell
cd frontend
npm run lint
```

---

## 8. Troubleshooting Database Connection Errors

### Error: `FATAL: (ENOTFOUND) tenant/user postgres.[REF] not found`
- **Cause**: Supabase connection poolers require the project reference to match the host region. If the project reference was created in `ap-south-1` (Mumbai) or `us-east-1` (N. Virginia), but the host in `DATABASE_URL` is set to `aws-0-ap-southeast-2.pooler.supabase.com` (Sydney), the pooler cannot find the tenant. Alternatively, the project was paused or deleted on Supabase.
- **Resolution**:
  1. Open your Supabase Dashboard -> **Project Settings** -> **Database**.
  2. Locate the **Connection string** section.
  3. Select **URI** and choose either **Direct connection** (`db.[REF].supabase.co:5432`) or **Connection pooling** (`aws-0-[YOUR-REGION].pooler.supabase.com:5432`).
  4. Ensure your password is correct and update `DATABASE_URL` in `backend/.env`.
  5. Run `curl http://localhost:8000/api/health` to confirm connectivity.

### Error: `[Errno 11001] getaddrinfo failed`
- **Cause**: DNS resolution failed for the database hostname.
- **Resolution**: Check internet access and verify the hostname spelling in `DATABASE_URL`.

### Error: `password authentication failed for user`
- **Cause**: Invalid password in the connection string. Special characters in passwords must be URL-encoded (e.g., `@` becomes `%40`, `#` becomes `%23`).

---

## 9. Safe Recovery Steps (Data Preservation)

1. **NEVER drop or recreate tables in production**:
   - The Alembic migrations are purely additive and idempotent (`IF NOT EXISTS` guards).
2. **NEVER overwrite model predictions**:
   - Analyst overrides write to `decision_overrides` and update `assessment.review_status`; they never mutate `prediction.default_probability` or `prediction.risk_level`.
3. **If remote database is unavailable**:
   - The backend readiness check (`/ready`) will return HTTP 503, preventing traffic routing to an unpersisted state.
   - Run unit and integration tests using the isolated test database runner (`pytest`).
