from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import datetime
import logging

from .config import settings
from .database.database import engine, Base, SessionLocal
from .database import models
from .routes import health, prediction, assessment, reports, business, documents, notifications, user, search
from .services.prediction_service import prediction_service

from sqlalchemy import text

# Database engine and routes initialized for Supabase PostgreSQL
logger = logging.getLogger(__name__)

def run_auto_migrations():
    """Ensures newly added table columns exist in existing PostgreSQL/SQLite databases."""
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        
        # Check if tables exist
        if "users" not in existing_tables:
            logger.info("Initializing tables via Base.metadata.create_all...")
            Base.metadata.create_all(bind=engine)
            return

        user_cols = {c["name"] for c in inspector.get_columns("users")}
        ass_cols = {c["name"] for c in inspector.get_columns("assessments")} if "assessments" in existing_tables else set()
        notif_cols = {c["name"] for c in inspector.get_columns("notifications")} if "notifications" in existing_tables else set()

        needs_user_migration = not {"role", "settings", "updated_at"}.issubset(user_cols)
        needs_ass_migration = not {"review_status", "review_notes", "reviewed_by", "reviewed_at"}.issubset(ass_cols)
        needs_notif_migration = "related_assessment_id" not in notif_cols

        if not (needs_user_migration or needs_ass_migration or needs_notif_migration):
            logger.info("Database schema already verified and up to date.")
            return

        with engine.connect() as conn:
            dialect = engine.dialect.name
            if dialect == "postgresql":
                logger.info("Executing PostgreSQL schema alignment migrations...")
                if "role" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';"))
                if "settings" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;"))
                if "updated_at" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))
                if "review_status" not in ass_cols:
                    conn.execute(text("ALTER TABLE assessments ADD COLUMN IF NOT EXISTS review_status VARCHAR(50) DEFAULT 'pending';"))
                if "review_notes" not in ass_cols:
                    conn.execute(text("ALTER TABLE assessments ADD COLUMN IF NOT EXISTS review_notes TEXT;"))
                if "reviewed_by" not in ass_cols:
                    conn.execute(text("ALTER TABLE assessments ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);"))
                if "reviewed_at" not in ass_cols:
                    conn.execute(text("ALTER TABLE assessments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;"))
                if "related_assessment_id" not in notif_cols:
                    conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_assessment_id INTEGER;"))
                conn.commit()
            elif dialect == "sqlite":
                for q in [
                    "ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';",
                    "ALTER TABLE users ADD COLUMN settings JSON DEFAULT '{}';",
                    "ALTER TABLE businesses ADD COLUMN location VARCHAR(255);",
                    "ALTER TABLE businesses ADD COLUMN description TEXT;",
                    "ALTER TABLE predictions ADD COLUMN positive_factors JSON DEFAULT '[]';",
                    "ALTER TABLE predictions ADD COLUMN risk_factors JSON DEFAULT '[]';",
                    "ALTER TABLE assessments ADD COLUMN review_status VARCHAR(50) DEFAULT 'pending';",
                    "ALTER TABLE assessments ADD COLUMN review_notes TEXT;",
                    "ALTER TABLE assessments ADD COLUMN reviewed_by VARCHAR(255);",
                    "ALTER TABLE assessments ADD COLUMN reviewed_at TIMESTAMP;",
                    "ALTER TABLE notifications ADD COLUMN related_assessment_id INTEGER;",
                    "UPDATE assessments SET review_status = 'pending' WHERE review_status IS NULL;",
                ]:
                    try:
                        conn.execute(text(q))
                        conn.commit()
                    except Exception:
                        pass
        logger.info("Auto migrations executed successfully.")
    except Exception as e:
        logger.warning(f"Auto-migration notice (non-fatal if already applied): {e}")

# Run migrations safely
run_auto_migrations()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix=f"{settings.API_V1_STR}", tags=["health"])
app.include_router(prediction.router, prefix=f"{settings.API_V1_STR}", tags=["prediction"])
app.include_router(assessment.router, prefix=f"{settings.API_V1_STR}/assessments", tags=["assessments"])
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports", tags=["reports"])
app.include_router(business.router, prefix=f"{settings.API_V1_STR}/businesses", tags=["businesses"])
app.include_router(documents.router, prefix=f"{settings.API_V1_STR}/documents", tags=["documents"])
app.include_router(notifications.router, prefix=f"{settings.API_V1_STR}/notifications", tags=["notifications"])
app.include_router(user.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(search.router, prefix=f"{settings.API_V1_STR}/search", tags=["search"])
app.add_api_route(f"{settings.API_V1_STR}/admin/audit-logs", user.get_admin_audit_logs, methods=["GET"], tags=["admin"])

def seed_db():
    """Seeds the database with initial demo MSME assessments ONLY if explicitly enabled in configuration."""
    if not settings.SEED_DEMO_DATA:
        return

    db = SessionLocal()
    try:
        if db.query(models.User).count() == 0:
            logger.info("SEED_DEMO_DATA is true. Seeding demo portfolio data...")
            demo_user = models.User(
                uid="demo_risk_analyst",
                email="analyst@msmerisk.ai",
                name="Demo Risk Analyst",
                role="admin"
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)

            mock_data = [
                {
                    "business": {
                        "name": "Aster Manufacturing",
                        "industry": "Manufacturing",
                        "location": "Chicago, IL",
                        "age": 8,
                        "employees": 45
                    },
                    "assessment": {
                        "annual_revenue": 2500000.0,
                        "monthly_cash_flow": 180000.0,
                        "monthly_expenses": 96000.0,
                        "existing_debt": 300000.0,
                        "digital_transactions": 450,
                        "utility_payment_score": 92.0,
                        "invoice_payment_score": 88.0,
                        "previous_defaults": 0
                    }
                },
                {
                    "business": {
                        "name": "Northstar Retail Co.",
                        "industry": "Retail",
                        "location": "Austin, TX",
                        "age": 3,
                        "employees": 12
                    },
                    "assessment": {
                        "annual_revenue": 850000.0,
                        "monthly_cash_flow": 45000.0,
                        "monthly_expenses": 48000.0,
                        "existing_debt": 150000.0,
                        "digital_transactions": 750,
                        "utility_payment_score": 68.0,
                        "invoice_payment_score": 72.0,
                        "previous_defaults": 1
                    }
                },
                {
                    "business": {
                        "name": "Greenfield Logistics",
                        "industry": "Logistics",
                        "location": "Atlanta, GA",
                        "age": 12,
                        "employees": 85
                    },
                    "assessment": {
                        "annual_revenue": 6200000.0,
                        "monthly_cash_flow": 520000.0,
                        "monthly_expenses": 380000.0,
                        "existing_debt": 800000.0,
                        "digital_transactions": 1200,
                        "utility_payment_score": 95.0,
                        "invoice_payment_score": 91.0,
                        "previous_defaults": 0
                    }
                }
            ]

            from .services.report_service import report_service

            for i, data in enumerate(mock_data):
                bus_info = data["business"]
                business_obj = models.Business(
                    user_id=demo_user.uid,
                    name=bus_info["name"],
                    industry=bus_info["industry"],
                    location=bus_info.get("location", "United States"),
                    age=bus_info["age"],
                    employees=bus_info["employees"]
                )
                db.add(business_obj)
                db.commit()
                db.refresh(business_obj)

                ass_info = data["assessment"]
                days_ago = [0, 1, 3][i]
                created_at = datetime.datetime.utcnow() - datetime.timedelta(days=days_ago)

                assessment_obj = models.Assessment(
                    business_id=business_obj.id,
                    annual_revenue=ass_info["annual_revenue"],
                    monthly_cash_flow=ass_info["monthly_cash_flow"],
                    monthly_expenses=ass_info["monthly_expenses"],
                    existing_debt=ass_info["existing_debt"],
                    digital_transactions=ass_info["digital_transactions"],
                    utility_payment_score=ass_info["utility_payment_score"],
                    invoice_payment_score=ass_info["invoice_payment_score"],
                    previous_defaults=ass_info["previous_defaults"],
                    created_at=created_at
                )
                db.add(assessment_obj)
                db.commit()
                db.refresh(assessment_obj)

                combined_info = {**bus_info, **ass_info}
                prediction_result = prediction_service.predict_risk(combined_info)

                prediction_obj = models.Prediction(
                    assessment_id=assessment_obj.id,
                    default_probability=prediction_result["default_probability"],
                    risk_level=prediction_result["risk_level"],
                    confidence=prediction_result["confidence"],
                    top_factors=prediction_result["top_factors"],
                    positive_factors=prediction_result.get("positive_factors", []),
                    risk_factors=prediction_result.get("risk_factors", []),
                    model_version=settings.MODEL_VERSION,
                    created_at=created_at
                )
                db.add(prediction_obj)

                report_data = report_service.generate_report_data(
                    business_data=combined_info,
                    assessment_data=combined_info,
                    prediction_data=prediction_result,
                    model_version=settings.MODEL_VERSION
                )
                
                report_obj = models.Report(
                    assessment_id=assessment_obj.id,
                    report_data=report_data,
                    created_at=created_at
                )
                db.add(report_obj)
                db.commit()
            logger.info("Demo data seeded successfully.")
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

seed_db()

@app.get("/")
def read_root():
    return {
        "message": "Welcome to MSME Risk AI backend API server.",
        "version": settings.MODEL_VERSION,
        "docs_url": "/docs"
    }
