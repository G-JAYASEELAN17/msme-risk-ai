"""
MSME Risk AI — Secure Administrator Provisioning Script
======================================================
Usage:
    python scripts/provision_initial_admin.py

Reads:
    INITIAL_ADMIN_EMAIL (default: jayaseelang177@gmail.com)
    INITIAL_ADMIN_PASSWORD (from environment or prompted securely via getpass)

This script:
1. Validates the password security policy (min 8 chars, mixed characters).
2. Connects using the trusted Firebase Admin SDK.
3. Provisions or updates the Firebase user account and sets custom claims: {"role": "admin"}.
4. Upserts the PostgreSQL/Supabase database user record with role='admin' and approval_status='active'.
5. Writes an immutable audit trail entry in the database.
6. Never prints secrets or plaintext passwords to standard output or logs.
"""

import sys
import os
import getpass
import datetime
import logging

# Ensure backend root is on sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(CURRENT_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.config import settings
from app.auth import init_firebase
from app.database.database import SessionLocal
from app.database import models
from firebase_admin import auth as firebase_auth

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("admin_provisioner")

def validate_password(password: str) -> bool:
    if len(password) < 8:
        return False
    has_digit = any(c.isdigit() for c in password)
    has_alpha = any(c.isalpha() for c in password)
    return has_digit and has_alpha

def provision_admin():
    init_firebase()

    admin_email = os.getenv("INITIAL_ADMIN_EMAIL", settings.INITIAL_ADMIN_EMAIL or "jayaseelang177@gmail.com").strip().lower()
    admin_password = os.getenv("INITIAL_ADMIN_PASSWORD", settings.INITIAL_ADMIN_PASSWORD or "")

    if not admin_password:
        print(f"[*] Provisioning administrator account for: {admin_email}")
        admin_password = getpass.getpass("Enter administrator password: ").strip()
        confirm_pw = getpass.getpass("Confirm administrator password: ").strip()
        if admin_password != confirm_pw:
            print("[!] Error: Passwords do not match.")
            sys.exit(1)

    if not validate_password(admin_password):
        print("[!] Error: Password must be at least 8 characters long and contain both letters and numbers.")
        sys.exit(1)

    print(f"[*] Connecting to Firebase Authentication for {admin_email}...")
    fb_uid = None
    try:
        user_record = firebase_auth.get_user_by_email(admin_email)
        fb_uid = user_record.uid
        print(f"[*] Existing Firebase user found (UID: {fb_uid}). Updating credentials and admin role...")
        firebase_auth.update_user(
            fb_uid,
            password=admin_password,
            email_verified=True,
            display_name=user_record.display_name or "System Administrator"
        )
    except firebase_auth.UserNotFoundError:
        print(f"[*] Creating new Firebase user for {admin_email}...")
        user_record = firebase_auth.create_user(
            email=admin_email,
            password=admin_password,
            display_name="System Administrator",
            email_verified=True
        )
        fb_uid = user_record.uid
        print(f"[+] Firebase user created with UID: {fb_uid}")
    except Exception as e:
        print(f"[!] Firebase Authentication error: {e}")
        sys.exit(1)

    # Set authoritative custom claim in Firebase
    try:
        firebase_auth.set_custom_user_claims(fb_uid, {"role": "admin"})
        print(f"[+] Custom claims set: role=admin for UID {fb_uid}")
    except Exception as e:
        logger.warning(f"Could not set Firebase custom user claims: {e}")

    # Synchronize database record
    print("[*] Synchronizing database record in PostgreSQL/Supabase...")
    db = SessionLocal()
    now = datetime.datetime.utcnow()
    try:
        db_user = db.query(models.User).filter(
            (models.User.email == admin_email) | (models.User.uid == fb_uid)
        ).first()

        if db_user:
            print(f"[*] Existing database user found (ID: {db_user.id}). Promoting to administrator...")
            db_user.uid = fb_uid
            db_user.email = admin_email
            db_user.role = "admin"
            db_user.approval_status = "active"
            db_user.email_verified_at = db_user.email_verified_at or now
            if not db_user.name:
                db_user.name = "System Administrator"
        else:
            print("[*] Creating new database administrator record...")
            db_user = models.User(
                uid=fb_uid,
                email=admin_email,
                name="System Administrator",
                role="admin",
                approval_status="active",
                email_verified_at=now,
                created_at=now
            )
            db.add(db_user)

        # Audit event
        audit_entry = models.AuditLog(
            action="INITIAL_ADMIN_PROVISIONED",
            resource_type="auth",
            resource_id=fb_uid,
            details={"message": f"Administrator {admin_email} provisioned securely via CLI."},
            user_id=fb_uid,
            created_at=now
        )
        db.add(audit_entry)

        db.commit()
        db.refresh(db_user)
        print(f"[SUCCESS] Administrator {admin_email} provisioned and verified successfully.")
        print(f"UID: {db_user.uid}")
        print(f"Role: {db_user.role}")
        print(f"Status: {db_user.approval_status}")
    except Exception as e:
        db.rollback()
        print(f"[!] Database error provisioning administrator: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    provision_admin()
