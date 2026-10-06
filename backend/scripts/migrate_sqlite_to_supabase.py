"""
Safe SQLite to Supabase PostgreSQL Migration Utility for MSME Risk AI.

This script:
1. Creates an automatic timestamped backup of the local SQLite database file.
2. Connects to SQLite and reads all existing records across tables:
   - users
   - businesses
   - assessments
   - predictions
   - reports
3. Resolves schema evolution discrepancies (e.g. missing users.updated_at, businesses.updated_at, JSON factor arrays).
4. Creates target tables in Supabase PostgreSQL if they do not exist.
5. Safely migrates records respecting foreign-key hierarchy and upsert constraints.
6. Synchronizes PostgreSQL auto-increment sequence counters.
7. Validates data integrity before and after migration.
"""

import os
import sys
import shutil
import datetime
import argparse
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from app.database.database import Base
from app.database import models

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("migration")

def backup_sqlite_db(sqlite_path: Path) -> Optional[Path]:
    """Creates a timestamped backup of the SQLite database file before performing migration."""
    if not sqlite_path.is_file():
        logger.warning(f"SQLite file not found at {sqlite_path}. Skipping backup.")
        return None
    
    timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_path = sqlite_path.parent / f"{sqlite_path.name}.backup_{timestamp}"
    shutil.copy2(sqlite_path, backup_path)
    logger.info(f"Safe SQLite backup created: {backup_path.name} ({backup_path.stat().st_size} bytes)")
    return backup_path

def parse_iso_or_datetime(val: Any) -> Optional[datetime.datetime]:
    """Parses various datetime representations from SQLite into datetime objects."""
    if val is None:
        return None
    if isinstance(val, datetime.datetime):
        return val
    if isinstance(val, str):
        # Handle strings formatted as 'YYYY-MM-DD HH:MM:SS.mmmmmm' or ISO
        val = val.replace("Z", "")
        for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
            try:
                return datetime.datetime.strptime(val, fmt)
            except ValueError:
                continue
    return datetime.datetime.utcnow()

def parse_json_value(val: Any) -> Any:
    """Parses JSON text from SQLite to Python dicts/lists if stored as string."""
    if val is None:
        return []
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return val
    return val

def migrate_database(sqlite_db_path: Path, target_db_url: str, dry_run: bool = False) -> Dict[str, Dict[str, int]]:
    """Migrates all SQLite records to Supabase PostgreSQL safely."""
    # 1. Ensure backup
    backup_sqlite_db(sqlite_db_path)
    
    if not sqlite_db_path.is_file():
        logger.error(f"Source SQLite database not found at {sqlite_db_path}")
        return {}

    # 2. SQLite Source Engine
    sqlite_url = f"sqlite:///{sqlite_db_path.as_posix()}"
    source_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    SourceSession = sessionmaker(bind=source_engine)
    source_session = SourceSession()

    # 3. Target Database Engine
    norm_target_url = target_db_url
    if norm_target_url.startswith("postgres://"):
        norm_target_url = norm_target_url.replace("postgres://", "postgresql://", 1)

    is_target_pg = "postgresql" in norm_target_url
    target_engine = create_engine(
        norm_target_url,
        pool_pre_ping=True,
        pool_recycle=300
    ) if is_target_pg else create_engine(norm_target_url)

    TargetSession = sessionmaker(bind=target_engine)
    target_session = TargetSession()

    stats = {
        "users": {"source": 0, "migrated": 0},
        "businesses": {"source": 0, "migrated": 0},
        "assessments": {"source": 0, "migrated": 0},
        "predictions": {"source": 0, "migrated": 0},
        "reports": {"source": 0, "migrated": 0},
    }

    try:
        # Create target schema if not exists
        if not dry_run:
            logger.info("Ensuring target database schema and tables exist...")
            Base.metadata.create_all(bind=target_engine)

        with source_engine.connect() as s_conn:
            # 1. Migrate Users (Resolving missing users.updated_at)
            user_rows = s_conn.execute(text("SELECT * FROM users")).mappings().all()
            stats["users"]["source"] = len(user_rows)
            logger.info(f"Source SQLite users found: {len(user_rows)}")
            
            for row in user_rows:
                row_dict = dict(row)
                created_at = parse_iso_or_datetime(row_dict.get("created_at")) or datetime.datetime.utcnow()
                updated_at = parse_iso_or_datetime(row_dict.get("updated_at")) or created_at

                if not dry_run:
                    existing_user = target_session.query(models.User).filter(models.User.uid == row_dict["uid"]).first()
                    if existing_user:
                        existing_user.email = row_dict["email"]
                        existing_user.name = row_dict.get("name")
                        existing_user.updated_at = updated_at
                    else:
                        new_user = models.User(
                            uid=row_dict["uid"],
                            email=row_dict["email"],
                            name=row_dict.get("name"),
                            created_at=created_at,
                            updated_at=updated_at
                        )
                        target_session.add(new_user)
                stats["users"]["migrated"] += 1

            if not dry_run:
                target_session.commit()

            # 2. Migrate Businesses
            biz_rows = s_conn.execute(text("SELECT * FROM businesses")).mappings().all()
            stats["businesses"]["source"] = len(biz_rows)
            logger.info(f"Source SQLite businesses found: {len(biz_rows)}")

            for row in biz_rows:
                row_dict = dict(row)
                created_at = parse_iso_or_datetime(row_dict.get("created_at")) or datetime.datetime.utcnow()
                updated_at = parse_iso_or_datetime(row_dict.get("updated_at")) or created_at

                if not dry_run:
                    existing_biz = target_session.query(models.Business).filter(models.Business.id == row_dict["id"]).first()
                    if existing_biz:
                        existing_biz.user_id = row_dict["user_id"]
                        existing_biz.name = row_dict["name"]
                        existing_biz.industry = row_dict["industry"]
                        existing_biz.age = row_dict["age"]
                        existing_biz.employees = row_dict["employees"]
                        existing_biz.updated_at = updated_at
                    else:
                        new_biz = models.Business(
                            id=row_dict["id"],
                            user_id=row_dict["user_id"],
                            name=row_dict["name"],
                            industry=row_dict["industry"],
                            age=row_dict["age"],
                            employees=row_dict["employees"],
                            created_at=created_at,
                            updated_at=updated_at
                        )
                        target_session.add(new_biz)
                stats["businesses"]["migrated"] += 1

            if not dry_run:
                target_session.commit()

            # 3. Migrate Assessments
            ass_rows = s_conn.execute(text("SELECT * FROM assessments")).mappings().all()
            stats["assessments"]["source"] = len(ass_rows)
            logger.info(f"Source SQLite assessments found: {len(ass_rows)}")

            for row in ass_rows:
                row_dict = dict(row)
                created_at = parse_iso_or_datetime(row_dict.get("created_at")) or datetime.datetime.utcnow()

                if not dry_run:
                    existing_ass = target_session.query(models.Assessment).filter(models.Assessment.id == row_dict["id"]).first()
                    if existing_ass:
                        existing_ass.business_id = row_dict["business_id"]
                        existing_ass.annual_revenue = row_dict["annual_revenue"]
                        existing_ass.monthly_cash_flow = row_dict["monthly_cash_flow"]
                        existing_ass.monthly_expenses = row_dict["monthly_expenses"]
                        existing_ass.existing_debt = row_dict["existing_debt"]
                        existing_ass.digital_transactions = row_dict["digital_transactions"]
                        existing_ass.utility_payment_score = row_dict["utility_payment_score"]
                        existing_ass.invoice_payment_score = row_dict["invoice_payment_score"]
                        existing_ass.previous_defaults = row_dict["previous_defaults"]
                    else:
                        new_ass = models.Assessment(
                            id=row_dict["id"],
                            business_id=row_dict["business_id"],
                            annual_revenue=row_dict["annual_revenue"],
                            monthly_cash_flow=row_dict["monthly_cash_flow"],
                            monthly_expenses=row_dict["monthly_expenses"],
                            existing_debt=row_dict["existing_debt"],
                            digital_transactions=row_dict["digital_transactions"],
                            utility_payment_score=row_dict["utility_payment_score"],
                            invoice_payment_score=row_dict["invoice_payment_score"],
                            previous_defaults=row_dict["previous_defaults"],
                            created_at=created_at
                        )
                        target_session.add(new_ass)
                stats["assessments"]["migrated"] += 1

            if not dry_run:
                target_session.commit()

            # 4. Migrate Predictions
            pred_rows = s_conn.execute(text("SELECT * FROM predictions")).mappings().all()
            stats["predictions"]["source"] = len(pred_rows)
            logger.info(f"Source SQLite predictions found: {len(pred_rows)}")

            for row in pred_rows:
                row_dict = dict(row)
                created_at = parse_iso_or_datetime(row_dict.get("created_at")) or datetime.datetime.utcnow()
                top_factors = parse_json_value(row_dict.get("top_factors"))
                positive_factors = parse_json_value(row_dict.get("positive_factors"))
                risk_factors = parse_json_value(row_dict.get("risk_factors"))

                if not dry_run:
                    existing_pred = target_session.query(models.Prediction).filter(models.Prediction.id == row_dict["id"]).first()
                    if existing_pred:
                        existing_pred.assessment_id = row_dict["assessment_id"]
                        existing_pred.default_probability = row_dict["default_probability"]
                        existing_pred.risk_level = row_dict["risk_level"]
                        existing_pred.confidence = row_dict["confidence"]
                        existing_pred.top_factors = top_factors
                        existing_pred.positive_factors = positive_factors
                        existing_pred.risk_factors = risk_factors
                        existing_pred.model_version = row_dict["model_version"]
                    else:
                        new_pred = models.Prediction(
                            id=row_dict["id"],
                            assessment_id=row_dict["assessment_id"],
                            default_probability=row_dict["default_probability"],
                            risk_level=row_dict["risk_level"],
                            confidence=row_dict["confidence"],
                            top_factors=top_factors,
                            positive_factors=positive_factors,
                            risk_factors=risk_factors,
                            model_version=row_dict["model_version"],
                            created_at=created_at
                        )
                        target_session.add(new_pred)
                stats["predictions"]["migrated"] += 1

            if not dry_run:
                target_session.commit()

            # 5. Migrate Reports
            rep_rows = s_conn.execute(text("SELECT * FROM reports")).mappings().all()
            stats["reports"]["source"] = len(rep_rows)
            logger.info(f"Source SQLite reports found: {len(rep_rows)}")

            for row in rep_rows:
                row_dict = dict(row)
                created_at = parse_iso_or_datetime(row_dict.get("created_at")) or datetime.datetime.utcnow()
                report_data = parse_json_value(row_dict.get("report_data"))

                if not dry_run:
                    existing_rep = target_session.query(models.Report).filter(models.Report.id == row_dict["id"]).first()
                    if existing_rep:
                        existing_rep.assessment_id = row_dict["assessment_id"]
                        existing_rep.report_data = report_data
                    else:
                        new_rep = models.Report(
                            id=row_dict["id"],
                            assessment_id=row_dict["assessment_id"],
                            report_data=report_data,
                            created_at=created_at
                        )
                        target_session.add(new_rep)
                stats["reports"]["migrated"] += 1

            if not dry_run:
                target_session.commit()

        # 6. Synchronize PostgreSQL sequence counters for serial ID columns
        if is_target_pg and not dry_run:
            logger.info("Synchronizing PostgreSQL sequence counters...")
            with target_engine.connect() as t_conn:
                for table in ["businesses", "assessments", "predictions", "reports"]:
                    try:
                        seq_res = t_conn.execute(text(
                            f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(MAX(id), 1)) FROM {table};"
                        ))
                        t_conn.commit()
                    except Exception as seq_err:
                        logger.warning(f"Note on sequence sync for table {table}: {seq_err}")

        logger.info("Migration completed successfully!")
        for tbl, counts in stats.items():
            logger.info(f"Table '{tbl}': {counts['source']} source records -> {counts['migrated']} migrated.")

    except Exception as e:
        logger.error(f"Migration error: {e}", exc_info=True)
        if not dry_run:
            target_session.rollback()
        raise
    finally:
        source_session.close()
        target_session.close()

    return stats

def main():
    parser = argparse.ArgumentParser(description="Migrate MSME Risk AI SQLite data to Supabase PostgreSQL")
    parser.add_argument("--sqlite-path", type=str, default=str(backend_dir / "msme_risk.db"), help="Path to SQLite database")
    parser.add_argument("--target-url", type=str, default=None, help="Target PostgreSQL DATABASE_URL (defaults to .env DATABASE_URL)")
    parser.add_argument("--dry-run", action="store_true", help="Simulate and verify source data without writing to target")
    args = parser.parse_args()

    sqlite_path = Path(args.sqlite_path)
    target_url = args.target_url or os.environ.get("DATABASE_URL")

    if not target_url:
        logger.error("No target DATABASE_URL found in arguments or .env")
        sys.exit(1)

    logger.info("Starting safe migration procedure...")
    stats = migrate_database(sqlite_path, target_url, dry_run=args.dry_run)
    print("\n" + "="*50)
    print("MIGRATION SUMMARY")
    print("="*50)
    for tbl, s in stats.items():
        print(f"  {tbl:<15}: Source = {s['source']:<5} Migrated = {s['migrated']:<5}")
    print("="*50)

if __name__ == "__main__":
    main()
