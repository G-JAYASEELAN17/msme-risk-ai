# MSME Risk AI: AI-Powered Credit Risk Assessment & Decision Support

[![Backend CI Tests](https://img.shields.io/badge/Backend%20Tests-44%20Passed-emerald.svg)]()
[![Model Version](https://img.shields.io/badge/Model-XGBoost%20v1.1.0-blue.svg)]()
[![ROC-AUC](https://img.shields.io/badge/ROC--AUC-0.9647-purple.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise-grade, full-stack AI decision-support platform for evaluating MSME (Micro, Small, and Medium Enterprises) loan default risk using traditional financials, non-traditional operational signals, explainable machine learning, and human-led analyst review workflows.

---

## 1. Executive Overview

Micro, Small, and Medium Enterprises represent over 90% of businesses and 50% of employment worldwide. However, traditional bank underwriting frequently rejects creditworthy MSMEs due to the **"thin-file" problem**—the lack of multi-year audited financial records or formal collateral.

**MSME Risk AI** bridges this gap by combining alternative financial velocity signals (digital transaction frequency, utility bill payment regularity, supplier invoice fulfillment) with traditional balance-sheet ratios. An optimized **XGBoost Classifier** evaluates risk into actuarially calibrated default probabilities and provides transparent factor attribution, empowering credit committees to underwrite faster with defensible auditability.

> **CRITICAL COMPLIANCE NOTICE**: MSME Risk AI is strictly a **decision-support platform**. The AI predicts default probabilities and highlights driving signals; it does **not** provide autonomous loan approvals, statutory credit ratings, or binding credit commitments. All lending decisions require human underwriter governance.

---

## 2. Core Features

- **AI Default Risk Prediction**: Real-time evaluation of default probability, calibrated into Low (<25%), Medium (25%–55%), and High (>55%) risk classifications with model confidence scoring.
- **Explainable Factor Attribution**: Isolates top positive health indicators and flagged default risks for every assessment, preventing black-box opacity.
- **What-If Scenario Simulation**: Stress-test prospective shocks (revenue contraction, debt expansion, cash flow shifts) in real time without altering official database records.
- **Institutional Analyst Review Portal**: Dedicated queue for underwriters to review portfolios, record underwriting notes, request supplemental documentation, and record official human determinations (Approved, Rejected, Needs Info).
- **Private Document Storage**: Secure file management via private Supabase Storage buckets with temporary signed URLs, strict MIME/extension validation, and user isolation.
- **Structured Document Extraction**: Distinguishes between real structured file parsing (e.g., CSV table parsing) and demonstration OCR previews, mandating human verification before applying values to assessments.
- **Multi-Tenant RBAC Security**: Strict backend enforcement across User (Borrower), Analyst, and Administrator tiers with IDOR resource ownership protection.
- **Immutable Audit Trail**: Append-only audit log tracking every assessment, simulation, status update, and administrative role change.
- **Executive Decision Reports**: Structured credit memos with key financial ratios, debt coverage, and printable compliance formatting.

---

## 3. System Architecture

```mermaid
graph TD
    User[User / Analyst / Admin] -->|HTTPS Requests| Frontend[React + TypeScript + Vite]
    Frontend -->|Bearer ID Token| Firebase[Firebase Authentication]
    Frontend -->|API Requests + X-Request-ID| Backend[FastAPI Backend Gateway]
    Backend -->|Verify Token Claims| Firebase
    Backend -->|Role-Based Access & Scoped Queries| DB[(Supabase PostgreSQL)]
    Backend -->|User-Isolated Storage & Signed URLs| Storage[Supabase Private Storage]
    Backend -->|Feature Scaling ColumnTransformer| Preprocessor[scaler.joblib]
    Preprocessor -->|Scaled Vectors| Model[model.joblib - XGBoost]
    Model -->|Default Prob & Factors| Backend
    Backend -->|Structured Audit Event| DB
```

---

## 4. Technology Stack

### Frontend
- **Framework**: React 18, TypeScript, Vite
- **Styling**: Vanilla CSS, Tailwind CSS (modern dark fintech theme)
- **Routing**: React Router 6 with authentication route guards
- **Authentication**: Firebase Authentication SDK (Email/Password + Google OAuth)
- **Icons**: Lucide React
- **SEO & Meta**: Semantic HTML5, dynamic title/meta description manager, OpenGraph, JSON-LD, `robots.txt`, and XML sitemap

### Backend
- **Framework**: FastAPI (Python 3.11), Uvicorn ASGI
- **Authentication**: Firebase Admin SDK (token verification with `ALLOW_TEST_AUTH` production toggle)
- **ORM & Database**: SQLAlchemy 2.0 with connection pooling (`pool_pre_ping=True`, keepalives)
- **Database Engine**: Supabase PostgreSQL
- **Schema Migrations**: Alembic (`alembic upgrade head`)
- **Document Storage**: Supabase Private Storage with signed temporary URLs
- **Rate Limiting**: In-memory sliding window rate limiter for mutating endpoints
- **Observability**: Request correlation ID (`X-Request-ID`), structured logging, `/health` and `/ready` probes

### Machine Learning
- **Algorithm**: XGBoost Classifier (`xgboost==2.0.3`)
- **Model Version**: `1.1.0`
- **Serialization**: Joblib (`model.joblib`, `scaler.joblib`)
- **Feature Pipeline**: `ColumnTransformer` (StandardScaler + SimpleImputer for numericals, OneHotEncoder for categoricals)
- **Explainability**: Rule-guided factor decomposition and feature contribution ranking

---

## 5. Machine Learning Methodology & Metrics

### Model Selection Rationale
During model evaluation across candidate algorithms, **XGBoost was chosen based on superior ROC-AUC performance (0.9647)**. ROC-AUC was established as the primary decision metric because rank-ordering default risk across positive and negative outcomes is the vital benchmark in financial credit underwriting.

| Model Algorithm | Accuracy | Precision | Recall | F1-Score | ROC-AUC |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **XGBoost (Selected)** | **91.8%** | **78.1%** | **82.0%** | **0.800** | **0.9647** |
| Random Forest | 92.4% | 85.2% | 75.0% | 0.798 | 0.9591 |
| Logistic Regression | 93.2% | 84.4% | 81.0% | 0.827 | 0.9571 |
| Decision Tree | 91.6% | 79.0% | 79.0% | 0.790 | 0.8990 |

### Features Utilized
- **Numerical (10)**: `age`, `employees`, `annual_revenue`, `monthly_cash_flow`, `monthly_expenses`, `existing_debt`, `digital_transactions`, `utility_payment_score`, `invoice_payment_score`, `previous_defaults`
- **Categorical (1)**: `industry` (Retail, Manufacturing, Services, Technology, Food & Beverage, Construction, Logistics, Healthcare)

### Known Model Limitations
- The model estimates default risk based on training distribution parameters. Unforeseen macroeconomic shocks (hyperinflation, sudden regulatory bans) are not captured by micro-telemetry alone.
- Models should be periodically re-calibrated against realized cohort loss rates.
- AI predictions must not be used as the sole reason for credit adverse action without human underwriter review.

---

## 6. Environment Variables

### Backend Configuration (`backend/.env`)

```ini
# Application Environment
APP_ENV=production
PROJECT_NAME="MSME Risk AI API"
API_V1_STR="/api"

# Supabase PostgreSQL Connection URL (Connection Pooler Port 6543 or Direct Port 5432)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require

# CORS Allowed Origins (Comma-separated or JSON array)
# Wildcard '*' is strictly rejected when credentials are enabled.
CORS_ORIGINS=["https://msme-risk-ai.vercel.app","http://localhost:5173"]

# Firebase Admin SDK Credentials
FIREBASE_PROJECT_ID=msme-risk-ai
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@msme-risk-ai.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Supabase Storage Configuration (Private bucket)
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[supabase-service-role-secret]
SUPABASE_STORAGE_BUCKET=msme-documents

# Test Authentication Toggle - CRITICAL: MUST BE false IN PRODUCTION
ALLOW_TEST_AUTH=false

# Optional Demo Seeding Toggle (false for clean tenant data isolation)
SEED_DEMO_DATA=false

# Model Version
MODEL_VERSION=1.1.0
```

### Frontend Configuration (`frontend/.env`)

```ini
# Backend API Base URL (Must include /api suffix)
VITE_API_BASE_URL=https://your-backend-api.onrender.com/api

# Firebase Web App Client Configuration
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=msme-risk-ai.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=msme-risk-ai
VITE_FIREBASE_STORAGE_BUCKET=msme-risk-ai.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=382218761380
VITE_FIREBASE_APP_ID=1:382218761380:web:...
```

---

## 7. Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- PostgreSQL or Supabase project

### Backend Setup

```bash
# Navigate to backend
cd backend

# Create and activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your Supabase DATABASE_URL and Firebase configuration

# Run database migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your VITE_API_BASE_URL (e.g. http://localhost:8000/api)

# Start Vite development server
npm run dev
```

---

## 8. Document Intelligence & OCR Architecture

The platform includes a real-time, human-in-the-loop financial document extraction pipeline allowing borrowers to upload statements, extract metrics, verify data, and pre-populate underwriting assessments.

### Processing Pipeline
```
Upload Document
       ↓
File Validation (Extension, MIME, Size ≤10MB)
       ↓
Private Supabase Storage (User-Isolated)
       ↓
Document Type Classification (9 Financial Categories)
       ↓
Text Extraction / OCR (Native PDF Text vs Scanned/Image OCR)
       ↓
Financial Field Extraction & Normalization
       ↓
Confidence Scoring (High ≥90%, Medium 70-89%, Low <70%)
       ↓
Extracted Data Preview & Inline Manual Correction
       ↓
User Verification ("Verify All Data")
       ↓
Transfer to Assessment Form (Human Approval Required)
       ↓
XGBoost Risk Evaluation
```

### Supported Document Types
1. `BANK_STATEMENT`: Account statements with average balances, credits, debits, cash flow.
2. `GST_DOCUMENT`: GSTR-1, GSTR-3B filings, taxable turnover, tax credits.
3. `INVOICE`: Commercial invoices, invoice dates, payment terms, amounts.
4. `UTILITY_BILL`: Commercial electricity, water, gas bills, payment reliability.
5. `PROFIT_LOSS`: P&L statements, gross revenue, operating expenses, EBITDA, net profit.
6. `BALANCE_SHEET`: Assets, liabilities, shareholder equity.
7. `INCOME_STATEMENT`: Operational turnover and margins.
8. `LOAN_STATEMENT`: Principal balance, interest rate, tenure, EMI repayments.
9. `OTHER`: General financial documents.

### OCR Provider Abstraction
The system uses an abstracted OCR layer configurable via `OCR_PROVIDER` environment variable:
- `mock` (Default): Fast, deterministic extraction for local development and CI testing. Zero external paid dependencies required.
- `tesseract`: On-premise local OCR using `pytesseract` and Tesseract-OCR executable.
- `cloud`: Cloud Document AI / AWS Textract / Azure Form Recognizer plug-in interface.

### Safety Guarantee: No Silent Submissions
In compliance with credit decisioning ethics, **the AI never silently submits or alters financial values**. The user reviews extracted data, can perform inline corrections (which preserves original audit history), verifies values, and must explicitly confirm transferring verified numbers into the assessment form.

---

## 9. Database Migrations (Supabase PostgreSQL)

Database schema migrations are strictly managed via **Alembic**. The application startup process does not execute ad-hoc DDL or modify tables automatically.

```bash
# Run all pending migrations
cd backend
alembic upgrade head

# Check current migration revision
alembic current

# Create a new migration revision
alembic revision -m "add_new_column_or_table"
```

---

## 10. Verification & Testing

The repository includes a comprehensive automated test suite covering authentication, RBAC authorization, assessments, ML prediction pipelines, What-If simulation, reports, documents, notifications, and health endpoints.

```bash
# Run Backend Pytest Suite
cd backend
pytest -v

# Run Frontend Production Build & Typecheck
cd frontend
npm run build

# Run Frontend ESLint Verification
npm run lint
```

---

## 11. Production Deployment Guide

### Architecture Topology
- **Frontend**: [Vercel](https://vercel.com) (Static SPA hosting with edge routing)
- **Backend**: [Render](https://render.com) or [Railway](https://railway.app) (FastAPI container service)
- **Database**: [Supabase PostgreSQL](https://supabase.com) (Managed PostgreSQL with connection pooler)
- **Document Storage**: [Supabase Storage](https://supabase.com/storage) (Private encrypted bucket)
- **Authentication**: [Firebase Authentication](https://firebase.google.com) (Identity management)

### Step 1: Supabase Setup
1. Create a Supabase project.
2. Note your database connection string in **Project Settings > Database > Connection string** (Transaction pooler port `6543`).
3. Create a private bucket named `msme-documents` in **Storage**. Ensure public access is turned **OFF**.
4. Retrieve your `SUPABASE_SERVICE_ROLE_KEY` from **Project Settings > API**.

### Step 2: Database Migration
From your deployment workstation or CI/CD runner:
```bash
cd backend
export DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require"
alembic upgrade head
```

### Step 3: Backend Deployment (e.g., Render)
1. Create a **Web Service** pointing to the repository.
2. Root Directory: `backend`
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Configure all backend environment variables (`DATABASE_URL`, `CORS_ORIGINS`, `FIREBASE_PROJECT_ID`, `ALLOW_TEST_AUTH=false`, etc.).
6. Health check path: `/health`

### Step 4: Frontend Deployment (e.g., Vercel)
1. Import the repository on Vercel.
2. Root Directory: `frontend`
3. Framework Preset: `Vite`
4. Build Command: `npm run build`
5. Output Directory: `dist`
6. Configure environment variables (`VITE_API_BASE_URL=https://your-backend.onrender.com/api`, `VITE_FIREBASE_API_KEY`, etc.).
7. Add your Vercel production domain to the backend `CORS_ORIGINS` variable.

---

## 12. Security & Compliance Architecture

- **Token Gating**: All protected endpoints require cryptographic verification via Firebase Bearer tokens.
- **IDOR Protection**: All database queries filter explicitly by `user_id == current_user.uid`.
- **RBAC Protection**: Roles (`user`, `analyst`, `admin`) are strictly enforced at the API route level.
- **Production Safety**: `ALLOW_TEST_AUTH=false` disables synthetic test tokens in production environments.
- **Secure File Ingestion**: File size is capped at 10 MB, extensions and MIME types are strictly validated, and files are stored with random UUID identifiers in private buckets.
- **No Wildcard CORS**: Cross-origin resource sharing rejects wildcard `*` with credentials in production.

---

## 13. License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
