import re
import io
import csv
import logging
from typing import Dict, Any, List, Optional, Tuple
from pydantic import BaseModel
from .ocr_service import get_ocr_provider, OCRResult, OCRPageResult

logger = logging.getLogger("extraction_service")

class ExtractedFieldData(BaseModel):
    field_name: str
    raw_value: Optional[str] = None
    normalized_value: Optional[float] = None
    string_value: Optional[str] = None
    confidence: float
    source_page: int = 1
    extraction_method: str = "native_text"
    explanation: Optional[str] = None

class DocumentExtractionResult(BaseModel):
    document_type: str
    overall_confidence: float
    fields: Dict[str, ExtractedFieldData]
    raw_text: str
    page_count: int
    is_scanned: bool
    extraction_method: str


def parse_financial_number(val_str: str) -> Optional[float]:
    """
    Safely normalizes currency and numeric strings into a non-negative float.
    Handles Indian number formatting (e.g. 12,50,000.00), Lakhs, Crores, and standard floats.
    Guarantees no NaN, infinite, or invalid negative numbers.
    """
    if not val_str:
        return None
    
    cleaned = val_str.strip()
    # Check for multiplier terms
    mult = 1.0
    lower = cleaned.lower()
    if "crore" in lower or " cr" in lower:
        mult = 10000000.0
    elif "lakh" in lower or " lac" in lower:
        mult = 100000.0
    elif "thousand" in lower or " k" in lower:
        mult = 1000.0

    # Strip currency symbols and non-numeric chars except digits and dot
    cleaned = re.sub(r"[₹$€£\s,A-Za-z/:]", "", cleaned)
    try:
        val = float(cleaned) * mult
        if val < 0 or val != val:  # Check negative or NaN
            return None
        return round(val, 2)
    except (ValueError, TypeError):
        return None


def extract_text_from_pdf(pdf_bytes: bytes) -> Tuple[List[OCRPageResult], bool]:
    """
    Extracts text page by page from PDF using pypdf.
    Returns (pages, is_scanned). If total text < 50 chars, marks as scanned.
    """
    pages: List[OCRPageResult] = []
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        total_len = 0
        for idx, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            total_len += len(text.strip())
            pages.append(OCRPageResult(
                page_number=idx,
                text=text,
                confidence=0.95,
                provider="pypdf"
            ))
        
        # If total text is very small, it's likely a scanned/raster PDF
        is_scanned = total_len < 60
        return pages, is_scanned
    except Exception as e:
        logger.warning(f"pypdf extraction failed or unreadable PDF: {e}")
        return [], True


def extract_document_text(file_bytes: bytes, filename: str, mime_type: str) -> Tuple[List[OCRPageResult], str, bool]:
    """
    Pipeline step 1: Extract text from PDF, image, or tabular file.
    Uses native PDF text when available, falls back to OCR for scanned PDFs or images.
    Returns (pages, extraction_method, is_scanned).
    """
    fname_lower = filename.lower()
    
    # 1. Plain CSV or text
    if fname_lower.endswith(".csv") or mime_type == "text/csv":
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
            return [OCRPageResult(page_number=1, text=text, confidence=0.98, provider="csv_parser")], "csv_parser", False
        except Exception:
            pass

    # 2. PDF Document
    if fname_lower.endswith(".pdf") or mime_type == "application/pdf":
        pages, is_scanned = extract_text_from_pdf(file_bytes)
        if not is_scanned and pages and any(len(p.text.strip()) > 30 for p in pages):
            return pages, "native_text", False
        
        # Scanned PDF: send to OCR provider
        ocr_result = get_ocr_provider().extract(file_bytes, filename, mime_type)
        return ocr_result.pages, f"ocr_{ocr_result.provider}", True

    # 3. Images (PNG, JPG, JPEG)
    if mime_type.startswith("image/") or any(fname_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg"]):
        ocr_result = get_ocr_provider().extract(file_bytes, filename, mime_type)
        return ocr_result.pages, f"ocr_{ocr_result.provider}", True

    # 4. Fallback to OCR provider
    ocr_result = get_ocr_provider().extract(file_bytes, filename, mime_type)
    return ocr_result.pages, f"ocr_{ocr_result.provider}", True


# Regex patterns with field targets
FIELD_PATTERNS: Dict[str, List[Tuple[str, float]]] = {
    "annual_revenue": [
        (r"(?:annual\s+revenue|annualized\s+revenue|annual\s+turnover|taxable\s+turnover|gross\s+revenue)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?(?:\s*(?:lakh|crore|cr|lac))?)", 0.94),
        (r"(?:total\s+revenue|total\s+turnover|revenue\s+from\s+operations)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?(?:\s*(?:lakh|crore|cr|lac))?)", 0.90),
    ],
    "monthly_revenue": [
        (r"(?:monthly\s+revenue|monthly\s+average\s+sales|average\s+monthly\s+credits|total\s+monthly\s+credits)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.92),
        (r"(?:monthly\s+turnover|monthly\s+sales)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.88),
    ],
    "monthly_expenses": [
        (r"(?:monthly\s+expenses|total\s+monthly\s+debits|monthly\s+operating\s+expenses|average\s+monthly\s+debits)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.92),
        (r"(?:operating\s+expenses|monthly\s+expenditure)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.88),
        (r"(?:expenses|expenditure)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.75),
    ],
    "monthly_cash_flow": [
        (r"(?:monthly\s+net\s+cash\s+flow|net\s+monthly\s+cash\s+flow|monthly\s+cash\s+flow)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.94),
        (r"(?:net\s+cash\s+flow|monthly\s+average\s+balance)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.85),
    ],
    "existing_debt": [
        (r"(?:existing\s+debt|outstanding\s+debt|term\s+loan\s+outstanding|overdraft\s+balance|existing\s+loans)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.93),
        (r"(?:current\s+liabilities|total\s+borrowings|debt\s+obligations)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.88),
        (r"(?:outstanding\s+balance|debt|liabilities)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.75),
    ],
    "total_assets": [
        (r"(?:total\s+assets|gross\s+assets)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.92),
        (r"(?:current\s+assets)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.85),
    ],
    "total_liabilities": [
        (r"(?:total\s+liabilities|aggregate\s+liabilities)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.92),
    ],
    "net_profit": [
        (r"(?:net\s+profit|profit\s+after\s+tax|pat)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.93),
        (r"(?:operating\s+profit|ebitda)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.85),
    ],
    "invoice_amount": [
        (r"(?:invoice\s+amount|total\s+invoice\s+value|grand\s+total|invoice\s+total)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.94),
    ],
    "loan_amount": [
        (r"(?:loan\s+amount|sanctioned\s+amount|borrowed\s+principal)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.94),
    ],
    "utility_payment_amount": [
        (r"(?:utility\s+payment\s+amount|bill\s+amount|current\s+charges)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.92),
    ],
    "gst_turnover": [
        (r"(?:taxable\s+turnover|gst\s+turnover|turnover\s+as\s+per\s+gst)[^\d₹$]*([₹$]?\s*[\d,]+(?:\.\d+)?)", 0.93),
    ],
    "digital_transactions": [
        (r"(?:total\s+transactions\s+count|total\s+digital\s+transactions|transaction\s+count|transactions)[^\d]*(\d+)", 0.90),
    ],
    "utility_payment_score": [
        (r"(?:utility\s+payment\s+(?:reliability\s+)?score|historical\s+payment\s+score)[^\d]*(\d+(?:\.\d+)?)", 0.92),
    ],
    "invoice_payment_score": [
        (r"(?:invoice\s+payment\s+(?:reliability\s+)?score)[^\d]*(\d+(?:\.\d+)?)", 0.92),
    ],
    "previous_defaults": [
        (r"(?:previous\s+defaults|defaults\s+recorded|cheque\s+bounces|dishonour\s+count)[^\d]*(\d+)", 0.92),
    ]
}

STRING_FIELD_PATTERNS: Dict[str, List[Tuple[str, float]]] = {
    "business_name": [
        (r"(?:account\s+holder|legal\s+name|entity|billed\s+to|company|consumer\s+name)[\s:]+([A-Za-z0-9\s&.,'-]{4,60})", 0.91),
    ],
    "statement_period": [
        (r"(?:statement\s+period|tax\s+period|period|billing\s+period)[\s:]+([A-Za-z0-9\s,-]{4,40})", 0.89),
    ],
    "invoice_date": [
        (r"(?:invoice\s+date|bill\s+date|date)[\s:]+(\d{1,2}[-/][A-Za-z0-9]{3,9}[-/]\d{2,4}|\d{4}-\d{2}-\d{2})", 0.92),
    ]
}


def extract_fields_from_pages(
    pages: List[OCRPageResult],
    base_method: str = "native_text"
) -> Dict[str, ExtractedFieldData]:
    """
    Extracts structured financial fields across document pages using targeted regex patterns.
    Applies strict confidence scoring and does NOT fabricate missing values.
    """
    results: Dict[str, ExtractedFieldData] = {}

    # 1. Extract string fields (business name, period, date)
    for field_name, patterns in STRING_FIELD_PATTERNS.items():
        found = False
        for page in pages:
            for pattern, pattern_conf in patterns:
                match = re.search(pattern, page.text, re.IGNORECASE)
                if match:
                    val_str = match.group(1).strip()
                    # Clean punctuation at end
                    val_str = re.split(r"[\n\r]", val_str)[0].strip()
                    if len(val_str) > 2:
                        conf = pattern_conf if "native" in base_method else pattern_conf * 0.92
                        results[field_name] = ExtractedFieldData(
                            field_name=field_name,
                            raw_value=match.group(0),
                            string_value=val_str,
                            confidence=round(conf, 2),
                            source_page=page.page_number,
                            extraction_method=base_method
                        )
                        found = True
                        break
            if found:
                break
        if not found:
            results[field_name] = ExtractedFieldData(
                field_name=field_name,
                raw_value=None,
                string_value=None,
                confidence=0.0,
                source_page=1,
                extraction_method=base_method,
                explanation="Value could not be reliably extracted."
            )

    # 2. Extract numeric financial fields
    for field_name, patterns in FIELD_PATTERNS.items():
        found = False
        for page in pages:
            for pattern, pattern_conf in patterns:
                match = re.search(pattern, page.text, re.IGNORECASE)
                if match:
                    raw_val = match.group(1).strip()
                    normalized = parse_financial_number(raw_val)
                    if normalized is not None:
                        conf = pattern_conf if "native" in base_method else pattern_conf * 0.92
                        results[field_name] = ExtractedFieldData(
                            field_name=field_name,
                            raw_value=match.group(0),
                            normalized_value=normalized,
                            string_value=str(normalized),
                            confidence=round(conf, 2),
                            source_page=page.page_number,
                            extraction_method=base_method
                        )
                        found = True
                        break
            if found:
                break
        
        if not found:
            results[field_name] = ExtractedFieldData(
                field_name=field_name,
                raw_value=None,
                normalized_value=None,
                confidence=0.0,
                source_page=1,
                extraction_method=base_method,
                explanation="Value could not be reliably extracted."
            )

    # Cross-field mathematical reconciliation:
    # If annual_revenue is missing but monthly_revenue exists, calculate annual as 12x with slightly lower confidence
    if results.get("annual_revenue") and results["annual_revenue"].normalized_value is None:
        if results.get("monthly_revenue") and results["monthly_revenue"].normalized_value is not None:
            m_rev = results["monthly_revenue"].normalized_value
            results["annual_revenue"] = ExtractedFieldData(
                field_name="annual_revenue",
                raw_value=f"Annualized from monthly revenue ({m_rev} * 12)",
                normalized_value=round(m_rev * 12, 2),
                string_value=str(round(m_rev * 12, 2)),
                confidence=0.85,
                source_page=results["monthly_revenue"].source_page,
                extraction_method="derived_annualized"
            )

    # If monthly_cash_flow is missing but revenue and expenses exist:
    if results.get("monthly_cash_flow") and results["monthly_cash_flow"].normalized_value is None:
        m_rev = results.get("monthly_revenue", ExtractedFieldData(field_name="m", confidence=0)).normalized_value
        m_exp = results.get("monthly_expenses", ExtractedFieldData(field_name="m", confidence=0)).normalized_value
        if m_rev is not None and m_exp is not None:
            cf = max(0.0, m_rev - m_exp)
            results["monthly_cash_flow"] = ExtractedFieldData(
                field_name="monthly_cash_flow",
                raw_value=f"Derived from monthly revenue ({m_rev}) - monthly expenses ({m_exp})",
                normalized_value=round(cf, 2),
                string_value=str(round(cf, 2)),
                confidence=0.84,
                source_page=1,
                extraction_method="derived_reconciliation"
            )

    return results


def run_document_extraction(
    file_bytes: bytes,
    filename: str,
    mime_type: str,
    document_type_hint: Optional[str] = None
) -> DocumentExtractionResult:
    """
    Main extraction pipeline entry point.
    Extracts text, classifies document type if not provided, extracts all financial fields with confidence.
    """
    pages, extraction_method, is_scanned = extract_document_text(file_bytes, filename, mime_type)
    full_text = "\n\n".join(p.text for p in pages)
    
    # Classify document type if not provided
    from .document_classifier import classify_document
    classification = classify_document(full_text, filename)
    doc_type = document_type_hint or classification.document_type

    # Extract structured fields
    fields = extract_fields_from_pages(pages, base_method=extraction_method)
    
    # Calculate overall confidence among extracted fields
    extracted_confs = [f.confidence for f in fields.values() if f.normalized_value is not None or f.string_value is not None]
    overall_conf = sum(extracted_confs) / len(extracted_confs) if extracted_confs else 0.50

    return DocumentExtractionResult(
        document_type=doc_type,
        overall_confidence=round(overall_conf, 2),
        fields=fields,
        raw_text=full_text,
        page_count=len(pages),
        is_scanned=is_scanned,
        extraction_method=extraction_method
    )
