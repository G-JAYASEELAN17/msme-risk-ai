-- ==============================================================================
-- MSME Risk AI - Supabase PostgreSQL Schema Definition
-- Tables: users, businesses, assessments, predictions, reports
-- ==============================================================================

-- 1. Users Table (Synchronized with Firebase Auth)
CREATE TABLE IF NOT EXISTS public.users (
    uid VARCHAR PRIMARY KEY,
    email VARCHAR NOT NULL UNIQUE,
    name VARCHAR,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_users_uid ON public.users (uid);
CREATE INDEX IF NOT EXISTS ix_users_email ON public.users (email);

-- 2. Businesses Table
CREATE TABLE IF NOT EXISTS public.businesses (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    industry VARCHAR NOT NULL,
    age INTEGER NOT NULL,
    employees INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_businesses_id ON public.businesses (id);
CREATE INDEX IF NOT EXISTS ix_businesses_user_id ON public.businesses (user_id);
CREATE INDEX IF NOT EXISTS ix_businesses_name ON public.businesses (name);

-- 3. Assessments Table
CREATE TABLE IF NOT EXISTS public.assessments (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    annual_revenue DOUBLE PRECISION NOT NULL,
    monthly_cash_flow DOUBLE PRECISION NOT NULL,
    monthly_expenses DOUBLE PRECISION NOT NULL,
    existing_debt DOUBLE PRECISION NOT NULL,
    digital_transactions INTEGER NOT NULL,
    utility_payment_score DOUBLE PRECISION NOT NULL,
    invoice_payment_score DOUBLE PRECISION NOT NULL,
    previous_defaults INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_assessments_id ON public.assessments (id);
CREATE INDEX IF NOT EXISTS ix_assessments_business_id ON public.assessments (business_id);

-- 4. Predictions Table
CREATE TABLE IF NOT EXISTS public.predictions (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER NOT NULL UNIQUE REFERENCES public.assessments(id) ON DELETE CASCADE,
    default_probability DOUBLE PRECISION NOT NULL,
    risk_level VARCHAR NOT NULL,
    confidence DOUBLE PRECISION NOT NULL,
    top_factors JSON NOT NULL,
    positive_factors JSON NOT NULL DEFAULT '[]'::json,
    risk_factors JSON NOT NULL DEFAULT '[]'::json,
    model_version VARCHAR NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_predictions_id ON public.predictions (id);
CREATE INDEX IF NOT EXISTS ix_predictions_assessment_id ON public.predictions (assessment_id);

-- 5. Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
    id SERIAL PRIMARY KEY,
    assessment_id INTEGER NOT NULL UNIQUE REFERENCES public.assessments(id) ON DELETE CASCADE,
    report_data JSON NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

CREATE INDEX IF NOT EXISTS ix_reports_id ON public.reports (id);
CREATE INDEX IF NOT EXISTS ix_reports_assessment_id ON public.reports (assessment_id);
