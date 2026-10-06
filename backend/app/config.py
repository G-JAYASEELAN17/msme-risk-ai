import os
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional

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
    
    PROJECT_NAME: str = "MSME Risk AI API"
    API_V1_STR: str = "/api"
    
    # DATABASE_URL loaded directly from backend/.env (Supabase PostgreSQL)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = [
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
    
    # Demo Data Seeding Toggle (False by default for strict user data isolation)
    SEED_DEMO_DATA: bool = False
    
    # ML Model & Preprocessor Configuration
    MODEL_VERSION: str = "1.1.0"
    MODEL_PATH: str = str(Path(__file__).resolve().parent.parent / "ml" / "models" / "model.joblib")
    PREPROCESSOR_PATH: str = str(Path(__file__).resolve().parent.parent / "ml" / "models" / "scaler.joblib")
    MODEL_METADATA_PATH: str = str(Path(__file__).resolve().parent.parent / "ml" / "models" / "model_metadata.json")

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
