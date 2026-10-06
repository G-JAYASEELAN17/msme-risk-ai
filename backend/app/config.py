import os
import json
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional, Union

# Absolute paths
BACKEND_DIR: Path = Path(__file__).resolve().parent.parent
ENV_PATH: Path = BACKEND_DIR / ".env"

# Explicitly load backend/.env into os.environ with override=True
if ENV_PATH.is_file():
    load_dotenv(dotenv_path=ENV_PATH, override=True)

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow"
    )
    
    APP_ENV: str = "production"
    DEBUG: bool = False
    PROJECT_NAME: str = "MSME Risk AI API"
    API_V1_STR: str = "/api"
    
    # DATABASE_URL loaded directly from backend/.env (Supabase PostgreSQL)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    # Raw CORS origins from environment (can be list, json string, or comma-separated string)
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]
    
    # Directory paths using pathlib
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    SECRETS_DIR: Path = Path(__file__).resolve().parent.parent / "secrets"
    
    # Firebase Admin Configuration
    FIREBASE_PROJECT_ID: str = "msme-risk-ai"
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None
    FIREBASE_CLIENT_EMAIL: Optional[str] = None
    FIREBASE_PRIVATE_KEY: Optional[str] = None
    FIREBASE_CLOCK_SKEW_SECONDS: int = 10
    
    # Supabase Storage Configuration
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "msme-documents"
    
    # OCR Configuration
    OCR_PROVIDER: str = "mock"  # mock | tesseract | cloud
    TESSERACT_CMD: Optional[str] = None
    
    # Test Authentication Toggle - MUST BE FALSE IN PRODUCTION
    ALLOW_TEST_AUTH: bool = False
    
    # Demo Data Seeding Toggle (False by default for strict user data isolation)
    SEED_DEMO_DATA: bool = False
    
    # ML Model & Preprocessor Configuration
    MODEL_VERSION: str = "1.1.0"
    MODEL_PATH: str = str(Path(__file__).resolve().parent.parent / "ml" / "models" / "model.joblib")
    PREPROCESSOR_PATH: str = str(Path(__file__).resolve().parent.parent / "ml" / "models" / "scaler.joblib")
    MODEL_METADATA_PATH: str = str(Path(__file__).resolve().parent.parent / "ml" / "models" / "model_metadata.json")

    @property
    def cors_origins_list(self) -> List[str]:
        """
        Parses CORS_ORIGINS safely into a list of allowed origins.
        Strictly forbids wildcard ('*') when credentials are enabled.
        """
        raw = self.CORS_ORIGINS
        origins: List[str] = []
        if isinstance(raw, list):
            origins = [str(o).strip().rstrip("/") for o in raw if str(o).strip()]
        elif isinstance(raw, str):
            raw_str = raw.strip()
            if raw_str.startswith("[") and raw_str.endswith("]"):
                try:
                    parsed = json.loads(raw_str)
                    origins = [str(o).strip().rstrip("/") for o in parsed if str(o).strip()]
                except Exception:
                    origins = [o.strip().rstrip("/") for o in raw_str.strip("[]").split(",") if o.strip()]
            else:
                origins = [o.strip().rstrip("/") for o in raw_str.split(",") if o.strip()]
        
        # Enforce security: NEVER allow '*' when allow_credentials=True in production
        sanitized = [o for o in origins if o != "*"]
        if not sanitized:
            # Safe local fallback in development
            return ["http://localhost:5173", "http://localhost:3000"]
        return sanitized

    def get_firebase_credentials_file(self) -> Optional[Path]:
        """Resolves the Firebase service account JSON credential path reliably using pathlib."""
        if self.FIREBASE_CREDENTIALS_PATH:
            p = Path(self.FIREBASE_CREDENTIALS_PATH)
            if p.is_file():
                return p
        
        # Check standard secrets directory locations
        candidates = [
            self.SECRETS_DIR / "firebase-service-account.json",
            self.SECRETS_DIR / "firebase-service-account.json.json",
            self.BASE_DIR / "secrets" / "firebase-service-account.json",
            self.BASE_DIR / "firebase-service-account.json",
        ]
        for candidate in candidates:
            if candidate.is_file():
                return candidate
        return None

settings = Settings()
