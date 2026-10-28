"""
Migration script to create:
1. identity_verifications
2. bank_accounts
3. bank_transactions
4. applicant_corrections
Supports both PostgreSQL (Supabase) and SQLite.
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
logger = logging.getLogger("identity_multibank_migration")

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

        # 1. identity_verifications
        if "identity_verifications" not in existing_tables:
            logger.info("Creating 'identity_verifications' table...")
            if is_pg:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS identity_verifications (
                        id SERIAL PRIMARY KEY,
                        user_id VARCHAR NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
                        business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
                        document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                        id_type VARCHAR NOT NULL,
                        masked_id VARCHAR NOT NULL,
                        id_hash VARCHAR(64),
                        name_on_doc VARCHAR,
                        dob_or_incorporation VARCHAR,
                        entity_type VARCHAR,
                        consent_obtained BOOLEAN NOT NULL DEFAULT FALSE,
                        consent_timestamp TIMESTAMP,
                        document_uploaded BOOLEAN NOT NULL DEFAULT TRUE,
                        text_extracted BOOLEAN NOT NULL DEFAULT FALSE,
                        extraction_confidence FLOAT NOT NULL DEFAULT 0.0,
                        format_valid BOOLEAN NOT NULL DEFAULT FALSE,
                        format_validation_notes TEXT,
                        declared_name_match BOOLEAN NOT NULL DEFAULT FALSE,
                        name_match_score FLOAT NOT NULL DEFAULT 0.0,
                        declared_details_match BOOLEAN NOT NULL DEFAULT FALSE,
                        match_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
                        external_verification_status VARCHAR NOT NULL DEFAULT 'UNABLE_TO_VERIFY',
                        external_verification_source VARCHAR,
                        external_verification_ref VARCHAR,
                        external_verification_message TEXT,
                        manual_review_status VARCHAR NOT NULL DEFAULT 'PENDING',
                        analyst_decision VARCHAR,
                        analyst_notes TEXT,
                        reviewed_by VARCHAR,
                        reviewed_at TIMESTAMP,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS ix_identity_user_id ON identity_verifications (user_id);
                    CREATE INDEX IF NOT EXISTS ix_identity_business_id ON identity_verifications (business_id);
                    CREATE INDEX IF NOT EXISTS ix_identity_id_type ON identity_verifications (id_type);
                    CREATE INDEX IF NOT EXISTS ix_identity_id_hash ON identity_verifications (id_hash);
                """))
            else:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS identity_verifications (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
                        business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
                        document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                        id_type TEXT NOT NULL,
                        masked_id TEXT NOT NULL,
                        id_hash TEXT,
                        name_on_doc TEXT,
                        dob_or_incorporation TEXT,
                        entity_type TEXT,
                        consent_obtained BOOLEAN NOT NULL DEFAULT 0,
                        consent_timestamp DATETIME,
                        document_uploaded BOOLEAN NOT NULL DEFAULT 1,
                        text_extracted BOOLEAN NOT NULL DEFAULT 0,
                        extraction_confidence REAL NOT NULL DEFAULT 0.0,
                        format_valid BOOLEAN NOT NULL DEFAULT 0,
                        format_validation_notes TEXT,
                        declared_name_match BOOLEAN NOT NULL DEFAULT 0,
                        name_match_score REAL NOT NULL DEFAULT 0.0,
                        declared_details_match BOOLEAN NOT NULL DEFAULT 0,
                        match_breakdown JSON NOT NULL DEFAULT '{}',
                        external_verification_status TEXT NOT NULL DEFAULT 'UNABLE_TO_VERIFY',
                        external_verification_source TEXT,
                        external_verification_ref TEXT,
                        external_verification_message TEXT,
                        manual_review_status TEXT NOT NULL DEFAULT 'PENDING',
                        analyst_decision TEXT,
                        analyst_notes TEXT,
                        reviewed_by TEXT,
                        reviewed_at DATETIME,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS ix_identity_user_id ON identity_verifications (user_id);
                    CREATE INDEX IF NOT EXISTS ix_identity_business_id ON identity_verifications (business_id);
                    CREATE INDEX IF NOT EXISTS ix_identity_id_type ON identity_verifications (id_type);
                    CREATE INDEX IF NOT EXISTS ix_identity_id_hash ON identity_verifications (id_hash);
                """))
            conn.commit()
            logger.info("Table 'identity_verifications' created.")
        else:
            logger.info("Table 'identity_verifications' already exists.")

        # 2. bank_accounts
        if "bank_accounts" not in existing_tables:
            logger.info("Creating 'bank_accounts' table...")
            if is_pg:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS bank_accounts (
                        id SERIAL PRIMARY KEY,
                        user_id VARCHAR NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
                        business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
                        statement_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                        bank_name VARCHAR NOT NULL,
                        account_number_masked VARCHAR NOT NULL,
                        account_type VARCHAR NOT NULL DEFAULT 'CURRENT',
                        ifsc_code VARCHAR,
                        account_holder_name VARCHAR,
                        is_primary BOOLEAN NOT NULL DEFAULT FALSE,
                        reporting_period_start VARCHAR,
                        reporting_period_end VARCHAR,
                        verification_status VARCHAR NOT NULL DEFAULT 'UPLOADED',
                        extracted_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS ix_bank_accounts_user_id ON bank_accounts (user_id);
                    CREATE INDEX IF NOT EXISTS ix_bank_accounts_business_id ON bank_accounts (business_id);
                    CREATE INDEX IF NOT EXISTS ix_bank_accounts_bank_name ON bank_accounts (bank_name);
                """))
            else:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS bank_accounts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
                        business_id INTEGER REFERENCES businesses(id) ON DELETE SET NULL,
                        statement_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                        bank_name TEXT NOT NULL,
                        account_number_masked TEXT NOT NULL,
                        account_type TEXT NOT NULL DEFAULT 'CURRENT',
                        ifsc_code TEXT,
                        account_holder_name TEXT,
                        is_primary BOOLEAN NOT NULL DEFAULT 0,
                        reporting_period_start TEXT,
                        reporting_period_end TEXT,
                        verification_status TEXT NOT NULL DEFAULT 'UPLOADED',
                        extracted_summary JSON NOT NULL DEFAULT '{}',
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS ix_bank_accounts_user_id ON bank_accounts (user_id);
                    CREATE INDEX IF NOT EXISTS ix_bank_accounts_business_id ON bank_accounts (business_id);
                    CREATE INDEX IF NOT EXISTS ix_bank_accounts_bank_name ON bank_accounts (bank_name);
                """))
            conn.commit()
            logger.info("Table 'bank_accounts' created.")
        else:
            logger.info("Table 'bank_accounts' already exists.")

        # 3. bank_transactions
        if "bank_transactions" not in existing_tables:
            logger.info("Creating 'bank_transactions' table...")
            if is_pg:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS bank_transactions (
                        id SERIAL PRIMARY KEY,
                        bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
                        document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                        transaction_date VARCHAR NOT NULL,
                        description TEXT NOT NULL,
                        reference_no VARCHAR,
                        debit FLOAT NOT NULL DEFAULT 0.0,
                        credit FLOAT NOT NULL DEFAULT 0.0,
                        balance FLOAT,
                        category VARCHAR NOT NULL DEFAULT 'unknown',
                        is_internal_transfer BOOLEAN NOT NULL DEFAULT FALSE,
                        transfer_confidence FLOAT NOT NULL DEFAULT 0.0,
                        matched_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL,
                        analyst_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
                        analyst_category_override VARCHAR,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS ix_bank_tx_account_id ON bank_transactions (bank_account_id);
                    CREATE INDEX IF NOT EXISTS ix_bank_tx_date ON bank_transactions (transaction_date);
                    CREATE INDEX IF NOT EXISTS ix_bank_tx_category ON bank_transactions (category);
                    CREATE INDEX IF NOT EXISTS ix_bank_tx_internal ON bank_transactions (is_internal_transfer);
                """))
            else:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS bank_transactions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
                        document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                        transaction_date TEXT NOT NULL,
                        description TEXT NOT NULL,
                        reference_no TEXT,
                        debit REAL NOT NULL DEFAULT 0.0,
                        credit REAL NOT NULL DEFAULT 0.0,
                        balance REAL,
                        category TEXT NOT NULL DEFAULT 'unknown',
                        is_internal_transfer BOOLEAN NOT NULL DEFAULT 0,
                        transfer_confidence REAL NOT NULL DEFAULT 0.0,
                        matched_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL,
                        analyst_reviewed BOOLEAN NOT NULL DEFAULT 0,
                        analyst_category_override TEXT,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS ix_bank_tx_account_id ON bank_transactions (bank_account_id);
                    CREATE INDEX IF NOT EXISTS ix_bank_tx_date ON bank_transactions (transaction_date);
                    CREATE INDEX IF NOT EXISTS ix_bank_tx_category ON bank_transactions (category);
                    CREATE INDEX IF NOT EXISTS ix_bank_tx_internal ON bank_transactions (is_internal_transfer);
                """))
            conn.commit()
            logger.info("Table 'bank_transactions' created.")
        else:
            logger.info("Table 'bank_transactions' already exists.")

        # 4. applicant_corrections
        if "applicant_corrections" not in existing_tables:
            logger.info("Creating 'applicant_corrections' table...")
            if is_pg:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS applicant_corrections (
                        id SERIAL PRIMARY KEY,
                        user_id VARCHAR NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
                        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
                        field_name VARCHAR NOT NULL,
                        original_value TEXT,
                        corrected_value TEXT NOT NULL,
                        reason TEXT NOT NULL,
                        replaced_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                        new_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                        submitted_by VARCHAR NOT NULL,
                        status VARCHAR NOT NULL DEFAULT 'PENDING_REVIEW',
                        analyst_notes TEXT,
                        reviewed_by VARCHAR,
                        reviewed_at TIMESTAMP,
                        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                        recalculated_at TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS ix_corrections_user_id ON applicant_corrections (user_id);
                    CREATE INDEX IF NOT EXISTS ix_corrections_business_id ON applicant_corrections (business_id);
                """))
            else:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS applicant_corrections (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
                        business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
                        field_name TEXT NOT NULL,
                        original_value TEXT,
                        corrected_value TEXT NOT NULL,
                        reason TEXT NOT NULL,
                        replaced_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                        new_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
                        submitted_by TEXT NOT NULL,
                        status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
                        analyst_notes TEXT,
                        reviewed_by TEXT,
                        reviewed_at DATETIME,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        recalculated_at DATETIME
                    );
                    CREATE INDEX IF NOT EXISTS ix_corrections_user_id ON applicant_corrections (user_id);
                    CREATE INDEX IF NOT EXISTS ix_corrections_business_id ON applicant_corrections (business_id);
                """))
            conn.commit()
            logger.info("Table 'applicant_corrections' created.")
        else:
            logger.info("Table 'applicant_corrections' already exists.")

    logger.info("All identity and multi-bank tables verified successfully.")
    return True

if __name__ == "__main__":
    success = run_migration()
    if not success:
        sys.exit(1)
