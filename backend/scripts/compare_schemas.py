import sqlite3
import os
from sqlalchemy import create_engine, text, inspect
from dotenv import load_dotenv

load_dotenv("backend/.env", override=True)
db_url = os.environ.get("DATABASE_URL")

print("=== SQLITE DATA (msme_risk.db) ===")
sqlite_path = "backend/msme_risk.db"
conn_sqlite = sqlite3.connect(sqlite_path)
cur_sqlite = conn_sqlite.cursor()

cur_sqlite.execute("SELECT name FROM sqlite_master WHERE type='table';")
sqlite_tables = [r[0] for r in cur_sqlite.fetchall() if not r[0].startswith("sqlite_")]
print("SQLite tables:", sqlite_tables)

for t in sqlite_tables:
    cur_sqlite.execute(f"PRAGMA table_info({t})")
    cols = [r[1] for r in cur_sqlite.fetchall()]
    cur_sqlite.execute(f"SELECT COUNT(*) FROM {t}")
    cnt = cur_sqlite.fetchone()[0]
    print(f"  SQLite '{t}': {cnt} records, columns: {cols}")

print("\n=== SUPABASE DATA ===")
engine = create_engine(db_url, pool_pre_ping=True)
inspector = inspect(engine)
for t in sqlite_tables:
    cols = [c["name"] for c in inspector.get_columns(t)]
    with engine.connect() as conn:
        cnt = conn.execute(text(f'SELECT COUNT(*) FROM "{t}"')).scalar()
    print(f"  Supabase '{t}': {cnt} records, columns: {cols}")

conn_sqlite.close()
