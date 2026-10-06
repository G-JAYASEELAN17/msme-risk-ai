"""
Initializes and verifies the PostgreSQL / Supabase database schema for MSME Risk AI.
Creates all tables, relationships, indexes, and triggers from SQLAlchemy models.
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
from app.database.database import Base
from app.database import models

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("schema_init")

def init_schema(db_url: str = None):
    url = db_url or os.environ.get("DATABASE_URL")
    if not url:
        logger.error("DATABASE_URL is not set in backend/.env or environment.")
        return False

    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    logger.info("Connecting to target database...")
    is_pg = "postgresql" in url
    engine = create_engine(
        url,
        pool_pre_ping=True,
        pool_recycle=300
    ) if is_pg else create_engine(url)

    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            dialect = conn.dialect.name
            logger.info(f"Database connection verified successfully. Dialect: {dialect}")

        logger.info("Creating all SQLAlchemy tables and constraints...")
        Base.metadata.create_all(bind=engine)

        inspector = inspect(engine)
        tables = inspector.get_table_names()
        logger.info(f"Target database tables ({len(tables)}): {tables}")

        for table in ["users", "businesses", "assessments", "predictions", "reports"]:
            if table in tables:
                cols = [c["name"] for c in inspector.get_columns(table)]
                logger.info(f"  Table '{table}' columns: {cols}")
            else:
                logger.warning(f"  Table '{table}' missing from target database!")

        return True
    except Exception as e:
        logger.error(f"Error initializing schema: {e}", exc_info=True)
        return False
    finally:
        engine.dispose()

if __name__ == "__main__":
    url_arg = sys.argv[1] if len(sys.argv) > 1 else None
    success = init_schema(url_arg)
    sys.exit(0 if success else 1)
