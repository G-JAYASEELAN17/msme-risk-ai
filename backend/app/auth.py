import logging
from typing import Optional
from pathlib import Path
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

from .config import settings
from .database.database import get_db
from .database import models

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK safely and securely
def init_firebase():
    if not firebase_admin._apps:
        cred_path = settings.get_firebase_credentials_file()
        if cred_path and cred_path.is_file():
            try:
                cred = credentials.Certificate(str(cred_path))
                firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin SDK initialized successfully with service account credentials.")
                return
            except Exception as e:
                logger.error(f"Error loading Firebase service account certificate: {e}")

        if settings.FIREBASE_CLIENT_EMAIL and settings.FIREBASE_PRIVATE_KEY:
            try:
                cred = credentials.Certificate({
                    "type": "service_account",
                    "project_id": settings.FIREBASE_PROJECT_ID,
                    "private_key": settings.FIREBASE_PRIVATE_KEY.replace("\\n", "\n"),
                    "client_email": settings.FIREBASE_CLIENT_EMAIL,
                    "token_uri": "https://oauth2.googleapis.com/token"
                })
                firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin SDK initialized with environment service account.")
                return
            except Exception as e:
                logger.error(f"Error initializing Firebase with env vars: {e}")

        try:
            firebase_admin.initialize_app(options={"projectId": settings.FIREBASE_PROJECT_ID})
            logger.info(f"Firebase Admin SDK initialized with project ID: {settings.FIREBASE_PROJECT_ID}")
        except Exception as e:
            logger.warning(f"Firebase Admin initialization note: {e}")

init_firebase()

security = HTTPBearer(auto_error=False)

from firebase_admin.auth import (
    ExpiredIdTokenError,
    RevokedIdTokenError,
    InvalidIdTokenError,
    CertificateFetchError
)
from firebase_admin.exceptions import FirebaseError

def verify_token_claims(token: str) -> dict:
    """
    Verifies a Firebase ID token and returns decoded claims.
    Strictly verifies tokens using Firebase Admin SDK verify_id_token.
    Supports test tokens for automated integration tests when token format is test_token:<uid>:<email>:<name>
    """
    if not token:
        logger.warning("Authentication failed: Empty token provided.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Test token support for automated unit/integration tests (strictly gated by ALLOW_TEST_AUTH)
    if token.startswith("test_token:"):
        if not settings.ALLOW_TEST_AUTH:
            logger.warning("Authentication failed: test_token provided while ALLOW_TEST_AUTH is disabled.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Test authentication tokens are disabled in production environment.",
                headers={"WWW-Authenticate": "Bearer"}
            )
        parts = token.split(":")
        uid = parts[1] if len(parts) > 1 and parts[1] else "test_user_default"
        email = parts[2] if len(parts) > 2 and parts[2] else f"{uid}@test.local"
        name = parts[3] if len(parts) > 3 and parts[3] else "Test User"
        return {
            "uid": uid,
            "email": email,
            "name": name,
            "sub": uid
        }

    try:
        decoded = firebase_auth.verify_id_token(
            token,
            check_revoked=False,
            clock_skew_seconds=settings.FIREBASE_CLOCK_SKEW_SECONDS
        )
        return decoded
    except ExpiredIdTokenError as e:
        logger.warning(f"Firebase token expired: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired. Please refresh your session.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except RevokedIdTokenError as e:
        logger.warning(f"Firebase token revoked: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has been revoked.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except InvalidIdTokenError as e:
        logger.warning(f"Firebase token invalid (signature mismatch or bad format): {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except CertificateFetchError as e:
        logger.error(f"Failed to fetch public certificates for token verification: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to verify token credentials with authentication provider.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except FirebaseError as e:
        logger.error(f"Firebase Admin SDK error during verification: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase authentication verification error.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception as e:
        logger.error(f"Unexpected token verification failure: {type(e).__name__} - {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"}
        )

def get_current_user(
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    """
    FastAPI dependency to authenticate the incoming request using Firebase Bearer tokens.
    Rejects requests with missing or invalid tokens with HTTP 401.
    Strictly synchronizes and isolates user records in the database.
    """
    if not auth_header or not auth_header.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing or invalid. Expected 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = auth_header.credentials.strip()
    claims = verify_token_claims(token)

    uid = claims.get("uid") or claims.get("sub")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing user UID.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    email = claims.get("email") or f"{uid}@msmerisk.ai"
    name = claims.get("name") or claims.get("displayName") or "MSME User"

    # Upsert user record in the database
    user = db.query(models.User).filter(models.User.uid == uid).first()
    if not user:
        # Check if email is used by another record to prevent unique constraint conflicts
        existing_email_user = db.query(models.User).filter(models.User.email == email).first()
        if existing_email_user:
            email = f"{uid}_{email}"

        user = models.User(
            uid=uid,
            email=email,
            name=name,
            role="user"
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except Exception as e:
            db.rollback()
            # If concurrent creation happened, re-fetch
            user = db.query(models.User).filter(models.User.uid == uid).first()
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Database error registering user: {str(e)}"
                )
    else:
        # Update name if changed
        if name and user.name != name:
            user.name = name
            try:
                db.commit()
                db.refresh(user)
            except Exception:
                db.rollback()

    return user

def require_role(allowed_roles: list[str]):
    """
    Factory for role-based authorization dependencies.
    Raises HTTP 403 FORBIDDEN if the user's role is not in allowed_roles.
    Returns HTTP 403 without exposing sensitive authorization details.
    """
    def role_checker(current_user: models.User = Depends(get_current_user)) -> models.User:
        user_role = (current_user.role or "user").lower()
        if user_role not in [r.lower() for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to perform this action."
            )
        return current_user
    return role_checker

require_analyst = require_role(["analyst", "admin"])
require_admin = require_role(["admin"])
