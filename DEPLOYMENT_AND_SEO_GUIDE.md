# MSME Risk AI — Production Deployment & SEO Guide

This guide provides instructions for deploying the **MSME Risk AI** platform to production on **Vercel** (Frontend) and **Render** (Backend), alongside Google Search Console verification and production configuration.

---

## 1. Architecture Overview

- **Frontend**: React + TypeScript + Vite, deployed on **Vercel** with SPA fallback rewrites.
- **Backend**: FastAPI + SQLAlchemy + Uvicorn, deployed on **Render** with gunicorn/uvicorn.
- **Database**: Supabase PostgreSQL with pooled TLS connection (`aws-0-ap-southeast-2.pooler.supabase.com`).
- **File Storage**: Supabase Private Storage with signed short-lived download URLs.
- **Authentication**: Firebase Authentication with server-side Admin SDK JWT verification.
- **ML Engine**: Pre-trained XGBoost v1.1.0 classifier + SHAP TreeExplainer (zero retraining required).

---

## 2. Frontend Deployment (Vercel)

### Step 1: Connect Repository
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New Project** and import the `msme-risk-ai` repository.

### Step 2: Configure Build Settings
- **Framework Preset**: `Vite`
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 3: Configure Environment Variables
In the Vercel project dashboard (**Settings > Environment Variables**), set:

| Variable Name | Description | Example / Value |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Public Render backend API base | `https://msme-risk-api.onrender.com/api` |
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | `msme-risk-ai.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | `msme-risk-ai` |
| `VITE_FIREBASE_STORAGE_BUCKET`| Firebase Storage Bucket | `msme-risk-ai.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM Sender ID | `123456789012` |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID | `1:123456789012:web:abcdef...` |

*(Note: `frontend/vercel.json` already contains SPA route rewrites and production HTTP security headers.)*

---

## 3. Backend Deployment (Render)

### Step 1: Deploy Web Service
1. Log in to [Render](https://render.com).
2. Click **New + > Web Service** and connect the repository (or utilize the root `render.yaml`).
3. Set the following parameters:
   - **Name**: `msme-risk-api`
   - **Environment**: `Python`
   - **Region**: `Oregon (US West)` or preferred region
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`

### Step 2: Configure Environment Variables
In the Render dashboard (**Environment** tab), add:

| Variable Name | Production Value / Description |
| :--- | :--- |
| `APP_ENV` | `production` |
| `DEBUG` | `false` |
| `ALLOW_TEST_AUTH` | `false` *(Critical: rejects mock headers)* |
| `SEED_DEMO_DATA` | `false` |
| `MODEL_VERSION` | `1.1.0` |
| `OCR_PROVIDER` | `heuristic` *(or `tesseract` if containerized)* |
| `DATABASE_URL` | `postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?sslmode=require` |
| `CORS_ORIGINS` | `["https://msme-risk-ai.vercel.app","https://yourdomain.com"]` |
| `SUPABASE_URL` | `https://[YOUR-PROJECT-REF].supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `[SUPABASE-SERVICE-ROLE-KEY]` |
| `SUPABASE_STORAGE_BUCKET` | `financial-documents` |
| `FIREBASE_PROJECT_ID` | `msme-risk-ai` |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"` |

### Step 3: Apply Database Migrations
Run migrations using the Render Shell or as a **Pre-Deploy Command**:
```bash
alembic upgrade head
```
*(Current migration head: `e8f9a0b1c2d3`)*

---

## 4. Google Search Console & Custom Domain Setup

Once your custom domain (e.g., `https://msmerisk.ai`) is pointed to Vercel:

### 1. Add Property in Search Console
1. Navigate to [Google Search Console](https://search.google.com/search-console).
2. Click **Add Property**.
3. Choose **Domain** (e.g. `msmerisk.ai`) or **URL prefix** (`https://msmerisk.ai`).

### 2. Verify Ownership
- **DNS Verification (Recommended for Domain property)**:
  Add the provided `TXT` record into your DNS provider (Cloudflare, Namecheap, Route53, GoDaddy).
- **HTML Tag Verification (For URL prefix)**:
  Copy the meta tag provided by Google and paste it into `frontend/index.html` inside the `<head>` section:
  ```html
  <meta name="google-site-verification" content="YOUR_VERIFICATION_CODE" />
  ```

### 3. Submit XML Sitemap
1. In Search Console, navigate to **Sitemaps** in the left sidebar.
2. In the "Add a new sitemap" input, enter:
   ```text
   sitemap.xml
   ```
3. Click **Submit**. Verify that the status shows **Success** and all 11 public URLs are discovered:
   - `/` (Homepage)
   - `/about`
   - `/how-it-works`
   - `/features`
   - `/responsible-ai`
   - `/security`
   - `/faq`
   - `/contact`
   - `/demo`
   - `/privacy`
   - `/terms`

### 4. Request Homepage Indexing
1. Use the **URL Inspection** search bar at the top of Google Search Console.
2. Enter your public homepage URL (`https://yourdomain.com/`).
3. Click **Test Live URL**.
4. Once verified, click **Request Indexing**.

### 5. Monitor Search Performance & Core Web Vitals
- Check the **Page indexing** report weekly for coverage.
- Confirm all authenticated routes (`/dashboard`, `/assessment`, `/prediction`, `/reports`, `/analyst`, `/admin/*`) remain excluded via `robots.txt` and `noindex` directives.
- Review **Core Web Vitals** under Experience to verify LCP (<2.5s), FID (<100ms), and CLS (<0.1).

---

## 5. Security & Isolation Verification Checklist

- [x] **No hardcoded secrets**: All API keys, service accounts, and database credentials use environment variables.
- [x] **No test authentication in production**: `ALLOW_TEST_AUTH=false` enforces cryptographic JWT verification via Firebase Admin SDK.
- [x] **No mock demo seeding in production**: `SEED_DEMO_DATA=false` guarantees tenant isolation.
- [x] **Safe error responses**: Internal 500 exceptions return `{ detail: "...", request_id: "..." }` without raw stack traces.
- [x] **Rate limiting**: Enforced at 60 req/min for general API, 20 req/min for assessments, and 15 req/min for demo endpoints.
- [x] **Private Document Storage**: Files stored under user UID namespaces with signed 1-hour URLs.
- [x] **Model Preserved**: XGBoost v1.1.0 classifier intact with identical ROC-AUC 0.9647 baseline.
