import re
from typing import Tuple, Dict, List
from pydantic import BaseModel

class ClassificationResult(BaseModel):
    document_type: str
    confidence: float
    matched_keywords: List[str]
    description: str

DOCUMENT_TYPES = [
    "BANK_STATEMENT",
    "GST_DOCUMENT",
    "INVOICE",
    "UTILITY_BILL",
    "PROFIT_LOSS",
    "BALANCE_SHEET",
    "INCOME_STATEMENT",
    "LOAN_STATEMENT",
    "OTHER"
]

# Weighted indicator terms for each financial document category
CATEGORY_PATTERNS: Dict[str, Dict[str, float]] = {
    "BANK_STATEMENT": {
        "bank statement": 4.0,
        "account statement": 4.0,
        "ifsc": 3.5,
        "account number": 3.0,
        "closing balance": 3.0,
        "opening balance": 2.5,
        "credit limit": 2.0,
        "debit": 2.0,
        "credit": 2.0,
        "cheque": 2.0,
        "neft": 2.5,
        "rtgs": 2.5,
        "upi": 2.0,
        "transaction date": 2.0,
        "hdfc": 2.0,
        "sbi": 2.0,
        "icici": 2.0,
        "axis bank": 2.0,
    },
    "GST_DOCUMENT": {
        "gstr": 4.0,
        "gstr-1": 4.5,
        "gstr-3b": 4.5,
        "gstin": 4.0,
        "goods and services tax": 3.5,
        "taxable turnover": 3.5,
        "input tax credit": 3.5,
        "cgst": 3.0,
        "sgst": 3.0,
        "igst": 3.0,
        "reverse charge": 2.5,
        "tax period": 2.0,
    },
    "INVOICE": {
        "tax invoice": 4.5,
        "invoice no": 4.0,
        "invoice number": 4.0,
        "bill to": 3.5,
        "billed to": 3.5,
        "purchase order": 3.0,
        "po number": 3.0,
        "due date": 2.5,
        "subtotal": 2.5,
        "invoice date": 3.0,
        "payment terms": 2.5,
    },
    "UTILITY_BILL": {
        "electricity": 4.0,
        "power distribution": 4.0,
        "consumer id": 4.0,
        "consumer number": 4.0,
        "kwh": 3.5,
        "units consumed": 3.5,
        "disconnection date": 3.0,
        "meter number": 3.5,
        "water bill": 4.0,
        "gas bill": 4.0,
        "bescom": 3.5,
        "tneb": 3.5,
        "mseb": 3.5,
    },
    "PROFIT_LOSS": {
        "profit and loss": 4.5,
        "statement of profit and loss": 5.0,
        "p&l": 4.0,
        "gross profit": 4.0,
        "net profit": 4.0,
        "operating expenses": 3.5,
        "ebitda": 3.5,
        "cost of goods sold": 3.0,
        "operating revenue": 3.0,
    },
    "BALANCE_SHEET": {
        "balance sheet": 5.0,
        "total assets": 4.5,
        "current assets": 4.0,
        "non-current assets": 3.5,
        "total liabilities": 4.5,
        "current liabilities": 4.0,
        "shareholder equity": 4.0,
        "reserves and surplus": 3.5,
    },
    "INCOME_STATEMENT": {
        "income statement": 5.0,
        "statement of income": 4.5,
        "net revenue": 4.0,
        "operating income": 4.0,
        "operating profit": 3.5,
        "revenue from operations": 4.0,
    },
    "LOAN_STATEMENT": {
        "loan statement": 5.0,
        "loan account": 4.5,
        "sanction letter": 4.0,
        "principal outstanding": 4.0,
        "interest rate": 3.0,
        "emi": 3.5,
        "loan tenure": 3.5,
        "disbursal": 3.0,
        "repayment schedule": 3.5,
    }
}

def classify_document(text: str, filename: str = "") -> ClassificationResult:
    """
    Classifies a financial document into one of the supported categories
    based on weighted term scoring, regex pattern matches, and filename indicators.
    """
    content = f"{filename} {text}".lower()
    
    scores: Dict[str, float] = {cat: 0.0 for cat in CATEGORY_PATTERNS}
    matched: Dict[str, List[str]] = {cat: [] for cat in CATEGORY_PATTERNS}

    # Filename bonus
    fname_lower = filename.lower()
    for cat, keywords in CATEGORY_PATTERNS.items():
        for kw, weight in keywords.items():
            if kw in fname_lower:
                scores[cat] += weight * 2.5
                matched[cat].append(f"filename:{kw}")
            elif kw in content:
                # Count occurrences up to a cap
                count = min(content.count(kw), 3)
                scores[cat] += weight * count
                matched[cat].append(kw)

    best_cat = "OTHER"
    best_score = 0.0

    for cat, score in scores.items():
        if score > best_score:
            best_score = score
            best_cat = cat

    # Normalize confidence to 0.50 - 0.98 range if matched, else low
    if best_score >= 12.0:
        confidence = min(0.98, 0.85 + (best_score / 100.0))
    elif best_score >= 6.0:
        confidence = min(0.85, 0.70 + (best_score / 50.0))
    elif best_score >= 2.5:
        confidence = 0.65
    else:
        best_cat = "OTHER"
        confidence = 0.50
        best_score = 0.0

    descriptions = {
        "BANK_STATEMENT": "Bank Account Statement / Passbook record showing deposits, withdrawals, and average balance.",
        "GST_DOCUMENT": "GST Tax Filing (GSTR-1, GSTR-3B) or official GST registration document.",
        "INVOICE": "Commercial Tax Invoice or Billing statement with itemized services.",
        "UTILITY_BILL": "Commercial Electricity, Water, or Gas utility statement.",
        "PROFIT_LOSS": "Audited Profit and Loss statement showing revenue, expenses, and net profit.",
        "BALANCE_SHEET": "Balance Sheet reflecting total assets, liabilities, and shareholder equity.",
        "INCOME_STATEMENT": "Income statement highlighting operational turnover and net margins.",
        "LOAN_STATEMENT": "Commercial bank loan statement or borrowing repayment schedule.",
        "OTHER": "General financial document or unspecified business record."
    }

    return ClassificationResult(
        document_type=best_cat,
        confidence=round(confidence, 2),
        matched_keywords=matched.get(best_cat, [])[:6],
        description=descriptions.get(best_cat, "General business document.")
    )
