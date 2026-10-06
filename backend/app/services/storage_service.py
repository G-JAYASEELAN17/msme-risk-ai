import os
import uuid
import logging
from pathlib import Path
from typing import Optional, Tuple
import httpx
from ..config import settings

logger = logging.getLogger(__name__)

# Fallback local storage directory (isolated by user UID)
LOCAL_STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)


class StorageService:
    def __init__(self):
        self.supabase_url = settings.SUPABASE_URL
        self.service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY
        self.bucket = settings.SUPABASE_STORAGE_BUCKET or "msme-documents"
        self._supabase_enabled = bool(self.supabase_url and self.service_role_key)

        if not self._supabase_enabled:
            logger.info("Supabase Storage credentials not configured. Using user-isolated local file storage for development.")

    @property
    def is_supabase_enabled(self) -> bool:
        return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)

    def _get_headers(self) -> dict:
        key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
        return {
            "Authorization": f"Bearer {key}",
            "apikey": key,
        }

    async def upload_file(
        self,
        file_bytes: bytes,
        user_id: str,
        original_filename: str,
        mime_type: str
    ) -> Tuple[str, str]:
        """
        Uploads a document to Supabase Storage (or user-isolated local storage).
        Returns tuple: (stored_filename, storage_path_or_key)
        """
        ext = os.path.splitext(original_filename)[1].lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        storage_path = f"users/{user_id}/{unique_name}"

        if self.is_supabase_enabled:
            try:
                upload_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{self.bucket}/{storage_path}"
                headers = self._get_headers()
                headers["Content-Type"] = mime_type

                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(upload_url, content=file_bytes, headers=headers)
                    if resp.status_code in (200, 201):
                        logger.info(f"Uploaded {original_filename} to Supabase Storage at {storage_path}")
                        return unique_name, storage_path
                    else:
                        logger.warning(f"Supabase storage upload returned {resp.status_code}: {resp.text}. Falling back to local storage.")
            except Exception as e:
                logger.error(f"Error uploading to Supabase Storage: {e}. Falling back to local storage.")

        # Local user-isolated fallback
        user_dir = LOCAL_STORAGE_DIR / user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        local_file = user_dir / unique_name
        with open(local_file, "wb") as f:
            f.write(file_bytes)

        return unique_name, str(local_file)

    async def get_download_url(self, user_id: str, storage_path_or_local: str, expires_in: int = 3600) -> Optional[str]:
        """
        Generates a secure temporary signed URL for Supabase storage or relative local download URL.
        Never makes documents public.
        """
        if self.is_supabase_enabled and storage_path_or_local.startswith("users/"):
            try:
                sign_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/sign/{self.bucket}/{storage_path_or_local}"
                headers = self._get_headers()
                headers["Content-Type"] = "application/json"
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(sign_url, json={"expiresIn": expires_in}, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        signed_relative = data.get("signedURL")
                        if signed_relative:
                            return f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1{signed_relative}"
            except Exception as e:
                logger.error(f"Error generating Supabase signed URL: {e}")

        return None

    async def delete_file(self, user_id: str, storage_path_or_local: str) -> bool:
        """
        Deletes a file from Supabase Storage or local isolated storage.
        """
        if self.is_supabase_enabled and storage_path_or_local.startswith("users/"):
            try:
                delete_url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/object/{self.bucket}/{storage_path_or_local}"
                headers = self._get_headers()
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.delete(delete_url, headers=headers)
                    if resp.status_code in (200, 204):
                        return True
            except Exception as e:
                logger.error(f"Error deleting from Supabase Storage: {e}")

        # Local fallback deletion
        p = Path(storage_path_or_local)
        if p.is_file():
            try:
                p.unlink()
                return True
            except Exception as e:
                logger.warning(f"Could not delete local file {p}: {e}")

        return False

    def get_local_path(self, storage_path_or_local: str) -> Optional[Path]:
        """Returns Path object if file exists locally."""
        p = Path(storage_path_or_local)
        if p.is_file():
            return p
        return None


storage_service = StorageService()
