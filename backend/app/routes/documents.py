import os
import io
import datetime
from pathlib import Path
from typing import List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session

from ..database.database import get_db
from ..database import models
from ..auth import get_current_user
from ..schemas.documents import (
    DocumentResponse,
    DocumentStatusResponse,
    DocumentExtractionDetailsResponse,
    DocumentExtractResponse,
    ExtractedFieldResponse,
    FieldUpdateRequest,
    DocumentTypeUpdateRequest,
    UseInAssessmentResponse
)
from ..services.audit_service import log_audit_event
from ..services.storage_service import storage_service
from ..services.document_service import document_service

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".csv", ".xlsx"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream"
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

def get_confidence_level(conf: float) -> str:
    """Classifies confidence into human-understandable buckets."""
    if conf >= 0.90:
        return "High"
    elif conf >= 0.70:
        return "Medium"
    return "Low"

def get_authorized_document(
    doc_id: int,
    current_user: models.User,
    db: Session,
    require_write: bool = False
) -> models.Document:
    """
    Enforces strict IDOR and RBAC protection.
    Users only access their own documents.
    Analysts/admins may view documents across tenants for review purposes.
    Only the document owner or an admin may write/delete.
    """
    doc = db.query(models.Document).filter(models.Document.id == doc_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )

    is_owner = doc.user_id == current_user.uid
    is_analyst_or_admin = getattr(current_user, "role", "user") in ["analyst", "admin"]

    if require_write:
        if not is_owner and getattr(current_user, "role", "user") != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to modify this document."
            )
    else:
        if not is_owner and not is_analyst_or_admin:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found or unauthorized."
            )

    return doc


@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists all uploaded financial documents for the authenticated user with isolated ownership.
    Analysts/admins may query tenant documents.
    """
    if getattr(current_user, "role", "user") in ["analyst", "admin"]:
        docs = db.query(models.Document).order_by(models.Document.created_at.desc()).all()
    else:
        docs = db.query(models.Document).filter(
            models.Document.user_id == current_user.uid
        ).order_by(models.Document.created_at.desc()).all()

    results = []
    for d in docs:
        bus_name = d.business.name if d.business else None
        download_url = await storage_service.get_download_url(d.user_id, d.file_path)
        if not download_url:
            download_url = f"/api/documents/{d.id}/download"

        field_count = len(d.fields) if d.fields else 0
        verified_count = sum(1 for f in d.fields if f.is_verified) if d.fields else 0

        results.append(DocumentResponse(
            id=d.id,
            business_id=d.business_id,
            business_name=bus_name,
            filename=d.filename,
            original_filename=d.original_filename,
            file_size=d.file_size,
            mime_type=d.mime_type,
            status=d.status,
            document_type=d.document_type or "OTHER",
            processing_status=d.processing_status or "UPLOADED",
            error_message=d.error_message,
            extracted_data=d.extracted_data or {},
            created_at=d.created_at,
            updated_at=d.updated_at,
            download_url=download_url,
            field_count=field_count,
            verified_count=verified_count
        ))
    return results


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    business_id: Optional[int] = Form(None),
    document_type: Optional[str] = Form(None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Securely uploads a financial statement or business document.
    Enforces extension, MIME, and size limits, storing in private Supabase Storage (with local fallback).
    Immediately initiates document classification and financial field extraction.
    """
    orig_name = file.filename or "document"
    ext = os.path.splitext(orig_name)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    mime_type = file.content_type or "application/octet-stream"
    if mime_type not in ALLOWED_MIME_TYPES and not mime_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file MIME type '{mime_type}'."
        )

    # Read file content safely
    contents = await file.read()
    file_size = len(contents)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File exceeds maximum allowed size of 10 MB."
        )
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot upload an empty file."
        )

    # Verify business ownership if business_id provided
    if business_id:
        bus = db.query(models.Business).filter(
            models.Business.id == business_id,
            models.Business.user_id == current_user.uid
        ).first()
        if not bus:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Specified business not found or unauthorized."
            )

    # Store file in private isolated storage
    stored_name, storage_path = await storage_service.upload_file(
        file_bytes=contents,
        user_id=current_user.uid,
        original_filename=orig_name,
        mime_type=mime_type
    )

    doc_type_initial = (document_type or "OTHER").upper()

    doc = models.Document(
        user_id=current_user.uid,
        business_id=business_id,
        filename=stored_name,
        original_filename=orig_name,
        file_size=file_size,
        mime_type=mime_type,
        file_path=storage_path,
        status="uploaded",
        document_type=doc_type_initial,
        processing_status="PROCESSING",
        extracted_data={}
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="DOCUMENT_UPLOADED",
        resource_type="document",
        resource_id=str(doc.id),
        details={
            "filename": orig_name,
            "size": file_size,
            "storage": "supabase" if storage_service.is_supabase_enabled else "local"
        }
    )

    # Run extraction pipeline
    doc = document_service.process_document(
        document_id=doc.id,
        user_id=current_user.uid,
        db=db,
        file_bytes=contents
    )

    bus_name = doc.business.name if doc.business else None
    download_url = await storage_service.get_download_url(current_user.uid, storage_path)
    if not download_url:
        download_url = f"/api/documents/{doc.id}/download"

    field_count = len(doc.fields) if doc.fields else 0
    verified_count = sum(1 for f in doc.fields if f.is_verified) if doc.fields else 0

    return DocumentResponse(
        id=doc.id,
        business_id=doc.business_id,
        business_name=bus_name,
        filename=doc.filename,
        original_filename=doc.original_filename,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        status=doc.status,
        document_type=doc.document_type,
        processing_status=doc.processing_status,
        error_message=doc.error_message,
        extracted_data=doc.extracted_data or {},
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        download_url=download_url,
        field_count=field_count,
        verified_count=verified_count
    )


@router.get("/{id}", response_model=DocumentResponse)
async def get_document(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves document metadata by ID."""
    doc = get_authorized_document(id, current_user, db, require_write=False)
    bus_name = doc.business.name if doc.business else None
    download_url = await storage_service.get_download_url(doc.user_id, doc.file_path)
    if not download_url:
        download_url = f"/api/documents/{doc.id}/download"

    field_count = len(doc.fields) if doc.fields else 0
    verified_count = sum(1 for f in doc.fields if f.is_verified) if doc.fields else 0

    return DocumentResponse(
        id=doc.id,
        business_id=doc.business_id,
        business_name=bus_name,
        filename=doc.filename,
        original_filename=doc.original_filename,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        status=doc.status,
        document_type=doc.document_type or "OTHER",
        processing_status=doc.processing_status or "UPLOADED",
        error_message=doc.error_message,
        extracted_data=doc.extracted_data or {},
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        download_url=download_url,
        field_count=field_count,
        verified_count=verified_count
    )


@router.get("/{id}/status", response_model=DocumentStatusResponse)
def get_document_status(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Polled by frontend to check OCR/extraction progress."""
    doc = get_authorized_document(id, current_user, db, require_write=False)
    field_count = len(doc.fields) if doc.fields else 0
    verified_count = sum(1 for f in doc.fields if f.is_verified) if doc.fields else 0

    return DocumentStatusResponse(
        id=doc.id,
        processing_status=doc.processing_status or "UPLOADED",
        document_type=doc.document_type or "OTHER",
        error_message=doc.error_message,
        field_count=field_count,
        verified_count=verified_count
    )


@router.get("/{id}/extraction", response_model=DocumentExtractionDetailsResponse)
def get_document_extraction(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns structured financial fields with confidence scores, source page,
    extraction method, and verification flags.
    """
    doc = get_authorized_document(id, current_user, db, require_write=False)

    fields_response = []
    for f in doc.fields:
        fields_response.append(ExtractedFieldResponse(
            id=f.id,
            document_id=f.document_id,
            field_name=f.field_name,
            raw_value=f.raw_value,
            normalized_value=f.normalized_value,
            string_value=f.string_value,
            confidence=f.confidence,
            confidence_level=get_confidence_level(f.confidence),
            source_page=f.source_page or 1,
            extraction_method=f.extraction_method,
            is_verified=f.is_verified,
            is_manually_edited=f.is_manually_edited,
            verified_value=f.verified_value,
            verified_by=f.verified_by,
            verified_at=f.verified_at
        ))

    overall_conf = (
        doc.extracted_data.get("overall_confidence", 0.88)
        if isinstance(doc.extracted_data, dict)
        else 0.88
    )

    can_use = doc.processing_status == "VERIFIED" and any(
        f.is_verified and f.field_name in ["annual_revenue", "monthly_cash_flow"]
        for f in doc.fields
    )

    return DocumentExtractionDetailsResponse(
        document_id=doc.id,
        document_name=doc.original_filename,
        document_type=doc.document_type or "OTHER",
        processing_status=doc.processing_status or "UPLOADED",
        overall_confidence=float(overall_conf),
        confidence_level=get_confidence_level(float(overall_conf)),
        fields=fields_response,
        warning="Please verify extracted financial information before using it for credit risk assessment.",
        can_use_in_assessment=can_use
    )


@router.patch("/{id}/type", response_model=DocumentResponse)
async def update_document_type(
    id: int,
    payload: DocumentTypeUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allows user to manually change detected document category."""
    doc = get_authorized_document(id, current_user, db, require_write=True)
    doc.document_type = payload.document_type.upper().strip()
    db.commit()
    db.refresh(doc)

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="DOCUMENT_TYPE_UPDATED",
        resource_type="document",
        resource_id=str(doc.id),
        details={"new_type": doc.document_type}
    )

    download_url = await storage_service.get_download_url(doc.user_id, doc.file_path)
    return DocumentResponse(
        id=doc.id,
        business_id=doc.business_id,
        filename=doc.filename,
        original_filename=doc.original_filename,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        status=doc.status,
        document_type=doc.document_type,
        processing_status=doc.processing_status,
        error_message=doc.error_message,
        extracted_data=doc.extracted_data or {},
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        download_url=download_url,
        field_count=len(doc.fields) if doc.fields else 0,
        verified_count=sum(1 for f in doc.fields if f.is_verified) if doc.fields else 0
    )


@router.patch("/{id}/fields/{field_id}", response_model=ExtractedFieldResponse)
def update_document_field(
    id: int,
    field_id: int,
    payload: FieldUpdateRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Allows user to manually edit an extracted field.
    Preserves original extracted value, confidence score, and creates audit entry.
    """
    get_authorized_document(id, current_user, db, require_write=True)
    field = document_service.update_field(
        document_id=id,
        field_id=field_id,
        user_id=current_user.uid,
        value=payload.value,
        db=db
    )

    return ExtractedFieldResponse(
        id=field.id,
        document_id=field.document_id,
        field_name=field.field_name,
        raw_value=field.raw_value,
        normalized_value=field.normalized_value,
        string_value=field.string_value,
        confidence=field.confidence,
        confidence_level=get_confidence_level(field.confidence),
        source_page=field.source_page or 1,
        extraction_method=field.extraction_method,
        is_verified=field.is_verified,
        is_manually_edited=field.is_manually_edited,
        verified_value=field.verified_value,
        verified_by=field.verified_by,
        verified_at=field.verified_at
    )


@router.post("/{id}/verify", response_model=DocumentStatusResponse)
def verify_document_data(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    User verifies all extracted fields in one action.
    Transitions status to 'VERIFIED'.
    """
    get_authorized_document(id, current_user, db, require_write=True)
    doc = document_service.verify_all_fields(
        document_id=id,
        user_id=current_user.uid,
        db=db
    )

    field_count = len(doc.fields) if doc.fields else 0
    verified_count = sum(1 for f in doc.fields if f.is_verified) if doc.fields else 0

    return DocumentStatusResponse(
        id=doc.id,
        processing_status=doc.processing_status,
        document_type=doc.document_type,
        error_message=doc.error_message,
        field_count=field_count,
        verified_count=verified_count
    )


@router.post("/{id}/use-in-assessment", response_model=UseInAssessmentResponse)
def use_in_assessment(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Transfers verified financial data to assessment input.
    Guarantees: Unverified fields are strictly rejected.
    """
    get_authorized_document(id, current_user, db, require_write=False)
    payload = document_service.get_assessment_payload(
        document_id=id,
        user_id=current_user.uid,
        db=db
    )

    return UseInAssessmentResponse(
        document_id=payload["document_id"],
        document_name=payload["document_name"],
        document_type=payload["document_type"],
        is_fully_verified=payload["is_fully_verified"],
        assessment_input=payload["assessment_input"],
        missing_required_fields=payload["missing_required_fields"],
        can_use_in_assessment=payload["can_use_in_assessment"],
        warning=payload["warning"]
    )


@router.post("/{id}/extract", response_model=DocumentExtractResponse)
def extract_document_data(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Triggers or re-runs document intelligence extraction.
    Maintains backward compatibility with legacy endpoint.
    """
    doc = get_authorized_document(id, current_user, db, require_write=True)
    doc = document_service.process_document(
        document_id=doc.id,
        user_id=current_user.uid,
        db=db
    )

    conf = (
        doc.extracted_data.get("overall_confidence", 0.90) * 100
        if isinstance(doc.extracted_data, dict)
        else 90.0
    )

    return DocumentExtractResponse(
        document_id=doc.id,
        status=doc.status,
        extracted_data=doc.extracted_data or {},
        confidence_score=round(float(conf), 1),
        extraction_mode="real",
        is_mock=False,
        disclaimer="Real financial data extracted. Please review and verify before applying to assessment."
    )


@router.get("/{id}/download")
async def download_document(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Authenticated direct download for uploaded document metadata.
    Enforces strict user isolation.
    """
    doc = get_authorized_document(id, current_user, db, require_write=False)

    local_path = storage_service.get_local_path(doc.file_path)
    if local_path and local_path.is_file():
        return FileResponse(
            path=str(local_path),
            filename=doc.original_filename,
            media_type=doc.mime_type
        )

    # Supabase storage signed URL redirect
    signed_url = await storage_service.get_download_url(doc.user_id, doc.file_path)
    if signed_url:
        return RedirectResponse(url=signed_url)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Document file content not found in storage."
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Deletes an uploaded document, removes its file from storage,
    and cascades deletion of all extracted fields.
    """
    doc = get_authorized_document(id, current_user, db, require_write=True)

    # Remove from storage
    await storage_service.delete_file(doc.user_id, doc.file_path)

    db.delete(doc)
    db.commit()

    log_audit_event(
        db=db,
        user_id=current_user.uid,
        action="DELETE_DOCUMENT",
        resource_type="document",
        resource_id=str(id),
        details={"filename": doc.original_filename}
    )

    return None
