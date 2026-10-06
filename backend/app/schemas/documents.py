from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any
import datetime

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
    extracted_data: Dict[str, Any]
    created_at: datetime.datetime

class DocumentExtractResponse(BaseModel):
    document_id: int
    status: str
    extracted_data: Dict[str, Any]
    confidence_score: float
    disclaimer: str = "AI-extracted — please verify values before applying to assessments."
