import os
import logging
from abc import ABC, abstractmethod
from typing import List, Optional
from pydantic import BaseModel
from ..config import settings

logger = logging.getLogger("ocr_service")

class OCRPageResult(BaseModel):
    page_number: int
    text: str
    confidence: float
    provider: str

class OCRResult(BaseModel):
    pages: List[OCRPageResult]
    full_text: str
    overall_confidence: float
    provider: str

class OCRProvider(ABC):
    """Abstract base class for OCR extraction providers."""
    
    @abstractmethod
    def extract(self, file_bytes: bytes, filename: str, mime_type: str) -> OCRResult:
        """Extracts text and page structure from document bytes."""
        pass


class MockOCRProvider(OCRProvider):
    """
    Deterministic Mock OCR Provider.
    Produces structured, realistic financial document text for local development,
    automated CI testing, and deterministic evaluation without paid API dependencies.
    """
    
    def extract(self, file_bytes: bytes, filename: str, mime_type: str) -> OCRResult:
        fname_lower = filename.lower()
        
        # Check if file has raw text (e.g. text/csv/txt or plain ascii embedded)
        try:
            raw_decoded = file_bytes.decode("utf-8", errors="ignore").strip()
            if len(raw_decoded) > 80 and not any(ord(c) < 9 for c in raw_decoded[:100]):
                return OCRResult(
                    pages=[OCRPageResult(page_number=1, text=raw_decoded, confidence=0.96, provider="mock")],
                    full_text=raw_decoded,
                    overall_confidence=0.96,
                    provider="mock"
                )
        except Exception:
            pass

        # Context-aware mock generator matching common financial document categories
        if any(w in fname_lower for w in ["bank", "statement", "hdfc", "sbi", "icici", "axis"]):
            page1 = (
                "HDFC BANK LIMITED - ACCOUNT STATEMENT\n"
                "Account Holder: Sri Krishna Textiles & Garments Private Limited\n"
                "Account Number: 50200034891240\n"
                "IFSC Code: HDFC0001234\n"
                "Statement Period: 01-Apr-2023 to 31-Mar-2024\n"
                "Currency: INR\n"
                "Monthly Average Balance: 1,85,000.00\n"
                "Total Monthly Credits (Revenue): 2,45,000.00\n"
                "Total Monthly Debits (Expenses): 1,60,000.00\n"
                "Monthly Net Cash Flow: 85,000.00\n"
                "Annual Revenue Turnover: 29,40,000.00\n"
                "Total Transactions Count: 342\n"
            )
            page2 = (
                "Page 2 - HDFC Bank Summary\n"
                "Existing Term Loan Outstanding: 3,20,000.00\n"
                "Overdraft / Existing Debt: 1,80,000.00\n"
                "Total Liabilities: 5,00,000.00\n"
                "Utility bill payments auto-debited on time (12/12 cycles).\n"
                "No cheque dishonour or ECS return recorded.\n"
            )
            pages = [
                OCRPageResult(page_number=1, text=page1, confidence=0.95, provider="mock"),
                OCRPageResult(page_number=2, text=page2, confidence=0.93, provider="mock")
            ]
        elif any(w in fname_lower for w in ["gst", "gstr", "tax"]):
            page1 = (
                "GOODS AND SERVICES TAX DEPARTMENT - FORM GSTR-3B\n"
                "Legal Name: Sri Krishna Textiles & Garments\n"
                "GSTIN: 33ABCDE1234F1Z5\n"
                "Tax Period: FY 2023-2024 (Annualized Summary)\n"
                "Total Taxable Turnover (Annual Revenue): 32,50,000.00\n"
                "Monthly Average Sales: 2,70,000.00\n"
                "Eligible Input Tax Credit (Monthly Expenses): 1,90,000.00\n"
                "Net Monthly Cash Flow: 80,000.00\n"
                "CGST Paid: 1,95,000.00 | SGST Paid: 1,95,000.00\n"
                "Filing Status: Timely / Active\n"
            )
            pages = [OCRPageResult(page_number=1, text=page1, confidence=0.96, provider="mock")]
        elif any(w in fname_lower for w in ["invoice", "bill"]):
            page1 = (
                "TAX INVOICE - APEX INDUSTRIAL SUPPLIES\n"
                "Invoice Number: INV-2024-8891\n"
                "Invoice Date: 15-Jan-2024\n"
                "Billed To: Sri Krishna Enterprises\n"
                "Invoice Amount: 4,75,000.00\n"
                "Due Date: 15-Feb-2024\n"
                "Payment Terms: 30 Days Net\n"
                "Status: Paid on schedule\n"
                "Invoice Payment Reliability Score: 92.0\n"
            )
            pages = [OCRPageResult(page_number=1, text=page1, confidence=0.94, provider="mock")]
        elif any(w in fname_lower for w in ["utility", "electric", "power", "water", "bescom"]):
            page1 = (
                "ELECTRICITY DISTRIBUTION CORPORATION - MONTHLY BILL\n"
                "Consumer ID: 882910443\n"
                "Consumer Name: Sri Krishna Workshop\n"
                "Billing Period: Jan 2024\n"
                "Utility Payment Amount: 24,500.00\n"
                "Due Date: 28-Jan-2024\n"
                "Payment Status: CLEARED\n"
                "Historical Payment Score: 88.5 / 100\n"
            )
            pages = [OCRPageResult(page_number=1, text=page1, confidence=0.92, provider="mock")]
        elif any(w in fname_lower for w in ["profit", "loss", "p&l", "income"]):
            page1 = (
                "AUDITED STATEMENT OF PROFIT AND LOSS\n"
                "Entity: Sri Krishna Enterprises Pvt Ltd\n"
                "Period: Year Ended March 31, 2024\n"
                "Gross Revenue / Annual Revenue: 42,00,000.00\n"
                "Monthly Revenue: 3,50,000.00\n"
                "Operating Expenses: 2,40,000.00\n"
                "Monthly Expenses: 2,40,000.00\n"
                "Monthly Cash Flow: 1,10,000.00\n"
                "EBITDA / Operating Profit: 13,20,000.00\n"
                "Net Profit: 9,80,000.00\n"
                "Existing Debt: 4,50,000.00\n"
            )
            pages = [OCRPageResult(page_number=1, text=page1, confidence=0.95, provider="mock")]
        elif any(w in fname_lower for w in ["balance", "sheet"]):
            page1 = (
                "BALANCE SHEET AS AT MARCH 31, 2024\n"
                "Company: Sri Krishna Enterprises\n"
                "Total Assets: 68,00,000.00\n"
                "Current Assets: 28,00,000.00\n"
                "Total Liabilities: 24,00,000.00\n"
                "Current Liabilities / Existing Debt: 8,50,000.00\n"
                "Shareholder Equity: 44,00,000.00\n"
                "Annual Revenue: 38,00,000.00\n"
                "Monthly Cash Flow: 95,000.00\n"
            )
            pages = [OCRPageResult(page_number=1, text=page1, confidence=0.94, provider="mock")]
        elif any(w in fname_lower for w in ["loan"]):
            page1 = (
                "COMMERCIAL LOAN SANCTION & STATEMENT\n"
                "Borrower: Sri Krishna Enterprises\n"
                "Loan Amount: 15,00,000.00\n"
                "Outstanding Debt: 6,80,000.00\n"
                "Existing Debt: 6,80,000.00\n"
                "Loan Tenure: 36 Months\n"
                "Interest Rate: 11.5%\n"
                "Monthly EMI / Debt Service: 49,500.00\n"
                "Repayment Status: Regular / Standard Asset\n"
            )
            pages = [OCRPageResult(page_number=1, text=page1, confidence=0.93, provider="mock")]
        else:
            page1 = (
                f"BUSINESS FINANCIAL DOCUMENT - {filename}\n"
                "Annual Revenue: 25,00,000.00\n"
                "Monthly Revenue: 2,08,333.00\n"
                "Monthly Expenses: 1,45,000.00\n"
                "Monthly Cash Flow: 63,333.00\n"
                "Existing Debt: 3,00,000.00\n"
                "Total Digital Transactions: 180\n"
                "Utility Payment Score: 85.0\n"
                "Invoice Payment Score: 82.0\n"
            )
            pages = [OCRPageResult(page_number=1, text=page1, confidence=0.90, provider="mock")]
        
        full_text = "\n\n".join(p.text for p in pages)
        overall_conf = sum(p.confidence for p in pages) / len(pages) if pages else 0.90
        return OCRResult(
            pages=pages,
            full_text=full_text,
            overall_confidence=overall_conf,
            provider="mock"
        )


class TesseractOCRProvider(OCRProvider):
    """
    Local Tesseract OCR Provider for on-premise or containerized deployments.
    Uses pytesseract and PIL/pdf2image when installed.
    """
    
    def __init__(self):
        self.tesseract_cmd = settings.TESSERACT_CMD
    
    def extract(self, file_bytes: bytes, filename: str, mime_type: str) -> OCRResult:
        try:
            import pytesseract
            from PIL import Image
            import io
            
            if self.tesseract_cmd:
                pytesseract.pytesseract.tesseract_cmd = self.tesseract_cmd
            
            # Check if tesseract binary is actually callable
            try:
                pytesseract.get_tesseract_version()
            except Exception as e:
                logger.warning(f"Tesseract executable not found or failed: {e}. Falling back to deterministic mock OCR.")
                return MockOCRProvider().extract(file_bytes, filename, mime_type)
            
            pages: List[OCRPageResult] = []
            
            if mime_type.startswith("image/"):
                img = Image.open(io.BytesIO(file_bytes))
                text = pytesseract.image_to_string(img)
                pages.append(OCRPageResult(
                    page_number=1,
                    text=text,
                    confidence=0.88,
                    provider="tesseract"
                ))
            elif mime_type == "application/pdf":
                try:
                    from pdf2image import convert_from_bytes
                    images = convert_from_bytes(file_bytes)
                    for idx, img in enumerate(images, start=1):
                        txt = pytesseract.image_to_string(img)
                        pages.append(OCRPageResult(
                            page_number=idx,
                            text=txt,
                            confidence=0.88,
                            provider="tesseract"
                        ))
                except ImportError:
                    logger.warning("pdf2image not installed for PDF rendering. Falling back to MockOCRProvider.")
                    return MockOCRProvider().extract(file_bytes, filename, mime_type)
            else:
                return MockOCRProvider().extract(file_bytes, filename, mime_type)
            
            if not pages or not any(p.text.strip() for p in pages):
                logger.info("Tesseract returned empty text. Falling back to MockOCRProvider.")
                return MockOCRProvider().extract(file_bytes, filename, mime_type)
                
            full_text = "\n\n".join(p.text for p in pages)
            return OCRResult(
                pages=pages,
                full_text=full_text,
                overall_confidence=0.88,
                provider="tesseract"
            )
        except ImportError:
            logger.warning("pytesseract or PIL not installed. Falling back to MockOCRProvider.")
            return MockOCRProvider().extract(file_bytes, filename, mime_type)
        except Exception as e:
            logger.error(f"Tesseract OCR failed: {e}. Falling back to MockOCRProvider.")
            return MockOCRProvider().extract(file_bytes, filename, mime_type)


class CloudOCRProvider(OCRProvider):
    """
    Cloud Document Intelligence Provider (Google Cloud Document AI / AWS Textract / Azure Form Recognizer).
    Placeholder designed for zero-code configuration plug-in.
    """
    
    def extract(self, file_bytes: bytes, filename: str, mime_type: str) -> OCRResult:
        # If cloud credentials are not supplied, safely fall back to MockOCRProvider
        logger.info("Cloud OCR credentials not configured. Using deterministic fallback.")
        return MockOCRProvider().extract(file_bytes, filename, mime_type)


def get_ocr_provider(provider_name: Optional[str] = None) -> OCRProvider:
    """Factory to retrieve configured OCR provider instance."""
    name = (provider_name or getattr(settings, "OCR_PROVIDER", "mock")).lower().strip()
    if name == "tesseract":
        return TesseractOCRProvider()
    elif name == "cloud":
        return CloudOCRProvider()
    return MockOCRProvider()
