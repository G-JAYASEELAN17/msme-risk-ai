from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any, List
import datetime

class ExtractedFieldResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    document_id: int
    field_name: str
    raw_value: Optional[str] = None
    normalized_value: Optional[float] = None
    string_value: Optional[str] = None
    confidence: float
    confidence_level: str = "High"  # High (>=0.90) | Medium (0.70-0.89) | Low (<0.70)
    source_page: int = 1
    extraction_method: str = "native_text"
    is_verified: bool = False
    is_manually_edited: bool = False
    verified_value: Optional[str] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime.datetime] = None

class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    business_id: Optional[int] = None
    business_name: Optional[str] = None
    filename: str
    original_filename: str
    file_size: int
    mime_type: str
    status: str
    document_type: str = "OTHER"
    processing_status: str = "UPLOADED"
    error_message: Optional[str] = None
    extracted_data: Dict[str, Any] = {}
    created_at: datetime.datetime
    updated_at: Optional[datetime.datetime] = None
    download_url: Optional[str] = None
    field_count: int = 0
    verified_count: int = 0

class DocumentStatusResponse(BaseModel):
    id: int
    processing_status: str
    document_type: str
    error_message: Optional[str] = None
    field_count: int = 0
    verified_count: int = 0

class DocumentExtractionDetailsResponse(BaseModel):
    document_id: int
    document_name: str
    document_type: str
    processing_status: str
    overall_confidence: float
    confidence_level: str = "High"
    fields: List[ExtractedFieldResponse]
    warning: str = "Please verify extracted financial information before using it for credit risk assessment."
    can_use_in_assessment: bool = False

class DocumentExtractResponse(BaseModel):
    document_id: int
    status: str
    extracted_data: Dict[str, Any]
    confidence_score: float
    extraction_mode: str = "real"  # "real" | "parsed" | "demo_preview"
    is_mock: bool = False
    disclaimer: str = "Please verify all extracted financial values before using them for risk assessment."

class FieldUpdateRequest(BaseModel):
    value: Any

class DocumentTypeUpdateRequest(BaseModel):
    document_type: str

class UseInAssessmentResponse(BaseModel):
    document_id: int
    document_name: str
    document_type: str
    is_fully_verified: bool
    assessment_input: Dict[str, Any]
    missing_required_fields: List[str]
    can_use_in_assessment: bool
    warning: Optional[str] = None
