"""
Safe schema migration for MSME Risk AI document verification columns.
Ensures file_hash, verification_report, analyst_decision, analyst_notes, reviewed_by, and reviewed_at exist.
Compatible with PostgreSQL (Supabase) and SQLite.
"""

import os
import sys
import logging
from pathlib import Path
from dotenv import load_dotenv

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

load_dotenv(backend_dir / ".env")

from sqlalchemy import create_engine, text, inspect
from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("document_migration")

def run_migration():
    db_url = settings.DATABASE_URL
    if not db_url:
        logger.error("DATABASE_URL is not set.")
        return False

    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    is_pg = "postgresql" in db_url
    engine = create_engine(db_url, pool_pre_ping=True)

    with engine.connect() as conn:
        inspector = inspect(engine)
        columns = [col["name"] for col in inspector.get_columns("documents")]
        logger.info(f"Existing columns in 'documents': {columns}")

        new_columns = [
            ("file_hash", "VARCHAR(64)" if is_pg else "TEXT"),
            ("verification_report", "JSONB DEFAULT '{}'::jsonb" if is_pg else "JSON DEFAULT '{}'"),
            ("analyst_decision", "VARCHAR" if is_pg else "TEXT"),
            ("analyst_notes", "TEXT"),
            ("reviewed_by", "VARCHAR" if is_pg else "TEXT"),
            ("reviewed_at", "TIMESTAMP" if is_pg else "DATETIME"),
        ]

        for col_name, col_type in new_columns:
            if col_name not in columns:
                logger.info(f"Adding column '{col_name}' ({col_type}) to 'documents' table...")
                if is_pg:
                    conn.execute(text(f"ALTER TABLE documents ADD COLUMN IF NOT EXISTS {col_name} {col_type};"))
                else:
                    conn.execute(text(f"ALTER TABLE documents ADD COLUMN {col_name} {col_type};"))
                conn.commit()
                logger.info(f"Column '{col_name}' added successfully.")
            else:
                logger.info(f"Column '{col_name}' already exists.")

        # Create index on file_hash if needed
        try:
            if is_pg:
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_documents_file_hash ON documents (file_hash);"))
            else:
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_documents_file_hash ON documents (file_hash);"))
            conn.commit()
            logger.info("Index 'ix_documents_file_hash' created or verified.")
        except Exception as e:
            logger.warning(f"Index creation note: {e}")

    logger.info("Document verification migration completed successfully.")
    return True

if __name__ == "__main__":
    run_migration()
