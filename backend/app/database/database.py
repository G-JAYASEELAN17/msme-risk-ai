import logging
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from ..config import settings

logger = logging.getLogger(__name__)

# Retrieve and validate database URL
db_url = settings.DATABASE_URL
if not db_url:
    logger.critical("FATAL: DATABASE_URL is not set in backend/.env!")
    raise RuntimeError("DATABASE_URL is missing. Please configure DATABASE_URL in backend/.env.")

if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

is_sqlite = db_url.startswith("sqlite")

engine_kwargs = {}
if is_sqlite:
    # SQLite configuration for testing
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # Supabase PostgreSQL configuration with connection pooling & liveness checks
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
        "pool_recycle": 60,
        "connect_args": {
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5,
        }
    })

engine = create_engine(
    db_url,
    **engine_kwargs
)

# Safe database diagnostic (Never print credentials)
dialect_name = engine.dialect.name
driver_name = engine.dialect.driver
host_name = engine.url.host or "local"
db_name = engine.url.database or "default"

sys.stdout.write(
    f"\n==================================================\n"
    f"[DATABASE ENGINE INITIALIZED]\n"
    f"  Dialect  : {dialect_name}\n"
    f"  Driver   : {driver_name}\n"
    f"  Host     : {host_name}\n"
    f"  Database : {db_name}\n"
    f"==================================================\n\n"
)
sys.stdout.flush()
logger.info(f"Database initialized: dialect={dialect_name}, driver={driver_name}, host={host_name}, db={db_name}")

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

