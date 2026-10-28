"""
Migration script to create 'document_exemptions' table.
Supports PostgreSQL (Supabase) and SQLite.
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
logger = logging.getLogger("document_exemptions_migration")

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
        existing_tables = inspector.get_table_names()
        logger.info(f"Existing tables in database: {existing_tables}")

        if "document_exemptions" not in existing_tables:
            logger.info("Creating 'document_exemptions' table...")
            if is_pg:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS document_exemptions (
                        id SERIAL PRIMARY KEY,
                        user_id VARCHAR NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
                        business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
                        category VARCHAR NOT NULL,
                        reason TEXT NOT NULL,
                        status VARCHAR NOT NULL DEFAULT 'APPROVED',
                        reviewed_by VARCHAR,
                        reviewed_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS ix_doc_exemptions_user_id ON document_exemptions(user_id);
                    CREATE INDEX IF NOT EXISTS ix_doc_exemptions_category ON document_exemptions(category);
                    CREATE INDEX IF NOT EXISTS ix_doc_exemptions_business_id ON document_exemptions(business_id);
                """))
            else:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS document_exemptions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id VARCHAR NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
                        business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
                        category VARCHAR NOT NULL,
                        reason TEXT NOT NULL,
                        status VARCHAR NOT NULL DEFAULT 'APPROVED',
                        reviewed_by VARCHAR,
                        reviewed_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS ix_doc_exemptions_user_id ON document_exemptions(user_id);
                    CREATE INDEX IF NOT EXISTS ix_doc_exemptions_category ON document_exemptions(category);
                    CREATE INDEX IF NOT EXISTS ix_doc_exemptions_business_id ON document_exemptions(business_id);
                """))
            conn.commit()
            logger.info("Successfully created 'document_exemptions' table and indexes.")
        else:
            logger.info("'document_exemptions' table already exists.")

    return True

if __name__ == "__main__":
    success = run_migration()
    if not success:
        sys.exit(1)
