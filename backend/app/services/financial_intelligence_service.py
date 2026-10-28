"""
MSME Risk AI — AI Financial Intelligence Engine
Comprehensive calculation and analysis service providing:
1. Decimal-safe financial calculations and consistent rounding.
2. Account-level and consolidated multi-bank intelligence.
3. Transaction classification and analyst override audit trails.
4. Cash-flow, revenue, profitability, liquidity, and debt repayment indicators.
5. Multi-source reconciliation (declared vs bank deposits vs GST vs P&L).
6. 4-dimensional data-quality scoring and automated discrepancy detection.
7. Provenance metadata tracking and idempotent recalculation.
"""

import datetime
from decimal import Decimal, ROUND_HALF_UP
import logging
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from ..database import models
from ..services.audit_service import log_audit_event

logger = logging.getLogger("financial_intelligence_service")

def safe_decimal(val: Any) -> Decimal:
    if val is None:
        return Decimal("0.00")
    try:
        return Decimal(str(val))
    except Exception:
        return Decimal("0.00")

# Quantize helper for currency (2 decimal places)
def round_curr(val: float | Decimal | None) -> float:
    if val is None:
        return 0.0
    try:
        d = Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return float(d)
    except Exception:
        return round(float(val), 2)

# Transaction categorization rule dictionary
EXPENSE_CATEGORIES = {
    "supplier_payment": [
        "raw material", "vendor", "supplier", "purchase", "traders", "supplies", 
        "packaging", "inventory", "stock", "wholesaler", "distributor"
    ],
    "payroll": [
        "salary", "payroll", "stipend", "wages", "staff", "bonus", "employee", "remuneration"
    ],
    "rent_utilities": [
        "rent", "electricity", "water", "internet", "broadband", "power", "utility", 
        "office lease", "maintenance", "telecom", "airtel", "jio"
    ],
    "tax_payment": [
        "gst", "advance tax", "challan", "income tax", "tds", "commercial tax", "cbic", "mca"
    ],
    "loan_repayment_emi": [
        "emi", "loan emi", "nach", "ecs", "auto debit loan", "bajaj fin", "hdfc bank loan",
        "icici loan", "sbi term loan", "magma", "chola", "shriram", "kotak loan", "term loan debit"
    ],
    "interest_payment": [
        "interest", "int pd", "od interest", "cc interest", "finance charge"
    ],
    "cash_withdrawal": [
        "atm wdl", "cash wdl", "self chq", "cash withdrawal"
    ],
    "own_account_transfer": [
        "self", "trf to own", "own a/c", "internal trf", "funds trf", "contra",
        "sweep", "auto sweep", "mod balance", "linked a/c"
    ]
}

CREDIT_CATEGORIES = {
    "sales_receipt": [
        "pos", "upi", "qr", "merchant", "settlement", "pg_settle", "razorpay", 
        "paytm", "bharatpe", "customer", "invoice", "sale", "neft cr", "rtgs cr", 
        "chq dep", "by clg", "collection", "bill desk", "cash dep", "customer payment"
    ],
    "loan_proceeds": [
        "disbursal", "disbursement", "loan cr", "term loan", "credit limit", 
        "working capital", "bajaj", "tata capital", "bank loan", "sanction"
    ],
    "refund": [
        "refund", "reversal", "chargeback", "gst refund", "it refund", "tax refund"
    ],
    "capital_injection": [
        "capital", "director loan", "share capital", "promoter", "partner contribution", "equity"
    ],
    "own_account_transfer": [
        "self", "trf to own", "own a/c", "internal trf", "funds trf", "contra",
        "sweep", "auto sweep", "mod balance", "linked a/c"
    ]
}

def classify_transaction(description: str, is_credit: bool) -> Tuple[str, float]:
    """
    Deterministic rule-based classification with confidence rating.
    Returns: (category, confidence)
    """
    desc = (description or "").lower()
    categories_dict = CREDIT_CATEGORIES if is_credit else EXPENSE_CATEGORIES

    for cat, keywords in categories_dict.items():
        if any(k in desc for k in keywords):
            return cat, 0.90 if cat in ["loan_repayment_emi", "tax_payment", "own_account_transfer"] else 0.85

    return ("sales_receipt" if is_credit else "operating_expense"), 0.60


class FinancialIntelligenceService:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create_business(self, user_id: str, business_id: Optional[int] = None) -> Optional[models.Business]:
        """Resolves target business for applicant."""
        if business_id:
            return self.db.query(models.Business).filter(models.Business.id == business_id).first()
        return self.db.query(models.Business).filter(models.Business.user_id == user_id).first()

    def detect_duplicate_files(self, user_id: str, docs: Optional[List[models.Document]] = None) -> List[Dict[str, Any]]:
        """Identifies duplicate uploaded statement documents via SHA-256 hash."""
        if docs is None:
            docs = self.db.query(models.Document).filter(
                models.Document.user_id == user_id,
                models.Document.file_hash.isnot(None)
            ).all()
        else:
            docs = [d for d in docs if d.file_hash is not None]

        seen_hashes: Dict[str, models.Document] = {}
        duplicates = []
        for d in docs:
            if d.file_hash in seen_hashes:
                original = seen_hashes[d.file_hash]
                duplicates.append({
                    "original_id": original.id,
                    "original_filename": original.original_filename,
                    "duplicate_id": d.id,
                    "duplicate_filename": d.original_filename,
                    "file_hash": d.file_hash
                })
            else:
                seen_hashes[d.file_hash] = d
        return duplicates

    def detect_duplicate_transactions(
        self,
        user_id: str,
        accounts: Optional[List[models.BankAccount]] = None,
        transactions: Optional[List[models.BankTransaction]] = None
    ) -> List[Dict[str, Any]]:
        """Identifies duplicated transaction entries across statements."""
        if transactions is None:
            if accounts is None:
                accounts = self.db.query(models.BankAccount).filter(models.BankAccount.user_id == user_id).all()
            acc_ids = [a.id for a in accounts]
            if not acc_ids:
                return []
            txs = self.db.query(models.BankTransaction).filter(
                models.BankTransaction.bank_account_id.in_(acc_ids)
            ).all()
        else:
            txs = transactions

        seen_keys: Dict[str, models.BankTransaction] = {}
        duplicates = []

        for t in txs:
            # Composite key: account + date + debit + credit + reference/desc
            ref = (t.reference_no or "").strip()
            key = f"{t.bank_account_id}:{t.transaction_date}:{t.debit}:{t.credit}:{ref or t.description[:30]}"
            if key in seen_keys:
                orig = seen_keys[key]
                duplicates.append({
                    "original_id": orig.id,
                    "duplicate_id": t.id,
                    "bank_account_id": t.bank_account_id,
                    "transaction_date": t.transaction_date,
                    "amount": t.credit if t.credit > 0 else t.debit,
                    "description": t.description
                })
            else:
                seen_keys[key] = t
        return duplicates

    def reconcile_internal_transfers(
        self,
        user_id: str,
        accounts: Optional[List[models.BankAccount]] = None,
        transactions: Optional[List[models.BankTransaction]] = None
    ) -> int:
        """
        Cross-account contra transfer matching:
        Matches debits in Account A with credits in Account B within +/- 2 calendar days and <= 1.0 INR difference.
        """
        if accounts is None:
            accounts = self.db.query(models.BankAccount).filter(models.BankAccount.user_id == user_id).all()
        if len(accounts) < 2:
            return 0

        if transactions is None:
            acc_ids = [a.id for a in accounts]
            all_debits = self.db.query(models.BankTransaction).filter(
                models.BankTransaction.bank_account_id.in_(acc_ids),
                models.BankTransaction.debit > 0
            ).all()
            all_credits = self.db.query(models.BankTransaction).filter(
                models.BankTransaction.bank_account_id.in_(acc_ids),
                models.BankTransaction.credit > 0
            ).all()
        else:
            all_debits = [t for t in transactions if (t.debit or 0.0) > 0]
            all_credits = [t for t in transactions if (t.credit or 0.0) > 0]

        matched = 0
        credits_by_account: Dict[int, List[Tuple[models.BankTransaction, Optional[datetime.datetime]]]] = {}
        for c in all_credits:
            try:
                c_dt = datetime.datetime.strptime(c.transaction_date, "%Y-%m-%d")
            except Exception:
                c_dt = None
            credits_by_account.setdefault(c.bank_account_id, []).append((c, c_dt))

        matched_credit_ids = set()
        for d in all_debits:
            try:
                d_dt = datetime.datetime.strptime(d.transaction_date, "%Y-%m-%d")
            except Exception:
                d_dt = None

            found_match = False
            for other_acc_id, credit_list in credits_by_account.items():
                if d.bank_account_id == other_acc_id:
                    continue
                for c, c_dt in credit_list:
                    if c.id in matched_credit_ids:
                        continue
                    if abs(d.debit - c.credit) <= 1.0:
                        days = 0
                        if d_dt and c_dt:
                            days = abs((d_dt - c_dt).days)
                        if days <= 2:
                            d.is_internal_transfer = True
                            d.category = "own_account_transfer"
                            d.transfer_confidence = 0.95 if days == 0 else 0.85
                            d.matched_account_id = c.bank_account_id

                            c.is_internal_transfer = True
                            c.category = "own_account_transfer"
                            c.transfer_confidence = 0.95 if days == 0 else 0.85
                            c.matched_account_id = d.bank_account_id
                            matched_credit_ids.add(c.id)
                            matched += 1
                            found_match = True
                            break
                if found_match:
                    break

        if matched > 0:
            self.db.commit()
        return matched

    def calculate_financial_intelligence(
        self,
        user_id: str,
        business_id: Optional[int] = None,
        trigger_source: str = "MANUAL_RECALCULATE"
    ) -> Dict[str, Any]:
        """
        Main calculation engine execution:
        Transforms bank transactions, document extractions, and declared financials into
        consolidated financial intelligence metrics, discrepancies, and data-quality scores.
        """
        started_at = datetime.datetime.utcnow()
        biz = self.get_or_create_business(user_id, business_id)
        b_id = biz.id if biz else business_id

        # 1. Retrieve accounts & transactions in batch
        accounts = self.db.query(models.BankAccount).filter(models.BankAccount.user_id == user_id).all()
        acc_ids = [a.id for a in accounts]
        
        transactions = []
        if acc_ids:
            transactions = self.db.query(models.BankTransaction).filter(
                models.BankTransaction.bank_account_id.in_(acc_ids)
            ).order_by(models.BankTransaction.transaction_date.asc()).all()

        # 2. Run internal transfer matching using in-memory dataset
        self.reconcile_internal_transfers(user_id, accounts=accounts, transactions=transactions)

        # 3. Retrieve user documents in single batch query
        user_docs = self.db.query(models.Document).filter(models.Document.user_id == user_id).all()

        # 3. Aggregate Cash Flow
        gross_credits = Decimal(0)
        gross_debits = Decimal(0)
        internal_transfers = Decimal(0)
        loan_proceeds = Decimal(0)
        refunds = Decimal(0)
        capital_injections = Decimal(0)
        loan_emis_total = Decimal(0)
        categorized_expenses: Dict[str, Decimal] = {}

        monthly_map: Dict[str, Dict[str, Decimal]] = {}
        daily_balances: Dict[str, List[float]] = {}

        for tx in transactions:
            cr = Decimal(str(tx.credit or 0.0))
            db = Decimal(str(tx.debit or 0.0))
            gross_credits += cr
            gross_debits += db

            cat = tx.analyst_category_override or tx.category

            # Internal transfers / non-revenue credits
            if tx.is_internal_transfer or cat == "own_account_transfer":
                internal_transfers += cr
            elif cat == "loan_proceeds":
                loan_proceeds += cr
            elif cat == "refund":
                refunds += cr
            elif cat == "capital_injection":
                capital_injections += cr

            # Debt repayment EMIs
            if cat == "loan_repayment_emi":
                loan_emis_total += db

            # Categorized Expenses
            if db > 0 and cat != "own_account_transfer":
                categorized_expenses[cat] = categorized_expenses.get(cat, Decimal(0)) + db

            # Monthly buckets
            m_key = tx.transaction_date[:7] if len(tx.transaction_date) >= 7 else "Unknown"
            if m_key not in monthly_map:
                monthly_map[m_key] = {
                    "credits": Decimal(0),
                    "debits": Decimal(0),
                    "business_receipts": Decimal(0),
                    "internal_transfers": Decimal(0),
                    "last_balance": Decimal(0)
                }
            monthly_map[m_key]["credits"] += cr
            monthly_map[m_key]["debits"] += db

            is_non_revenue = tx.is_internal_transfer or cat in ["own_account_transfer", "loan_proceeds", "refund", "capital_injection"]
            if not is_non_revenue and cr > 0:
                monthly_map[m_key]["business_receipts"] += cr
            if tx.is_internal_transfer or cat == "own_account_transfer":
                monthly_map[m_key]["internal_transfers"] += cr

            if tx.balance is not None:
                monthly_map[m_key]["last_balance"] = Decimal(str(tx.balance))
                daily_balances.setdefault(tx.transaction_date, []).append(float(tx.balance))

        # True business receipts = gross credits - (internal transfers + loans + refunds + capital injections)
        true_business_receipts = max(Decimal(0), gross_credits - (internal_transfers + loan_proceeds + refunds + capital_injections))
        net_cash_flow = gross_credits - gross_debits

        # Monthly trends
        sorted_months = sorted([k for k in monthly_map.keys() if k != "Unknown"])
        coverage_months = len(sorted_months)

        monthly_trends = []
        positive_flow_months = 0
        negative_flow_months = 0
        monthly_net_flows: List[float] = []

        for m in sorted_months:
            data = monthly_map[m]
            m_net = float(data["credits"] - data["debits"])
            monthly_net_flows.append(m_net)
            if m_net >= 0:
                positive_flow_months += 1
            else:
                negative_flow_months += 1

            monthly_trends.append({
                "month": m,
                "credits": round_curr(data["credits"]),
                "debits": round_curr(data["debits"]),
                "business_receipts": round_curr(data["business_receipts"]),
                "internal_transfers": round_curr(data["internal_transfers"]),
                "net_cash_flow": round_curr(m_net),
                "closing_balance": round_curr(data["last_balance"]) if data["last_balance"] != 0 else None
            })

        # Cash flow volatility (std dev / mean absolute flow)
        volatility = 0.0
        if len(monthly_net_flows) > 1:
            avg_flow = sum(monthly_net_flows) / len(monthly_net_flows)
            variance = sum((x - avg_flow) ** 2 for x in monthly_net_flows) / len(monthly_net_flows)
            std_dev = variance ** 0.5
            volatility = round(std_dev / max(1000.0, abs(avg_flow)), 2)

        # Average closing balance
        closing_balances = [float(data["last_balance"]) for data in monthly_map.values() if data["last_balance"] != 0]
        avg_closing_balance = round(sum(closing_balances) / len(closing_balances), 2) if closing_balances else None
        latest_closing_balance = closing_balances[-1] if closing_balances else None

        # Sequence gap detection
        missing_periods = []
        if len(sorted_months) >= 2:
            try:
                cur_dt = datetime.datetime.strptime(sorted_months[0], "%Y-%m")
                end_dt = datetime.datetime.strptime(sorted_months[-1], "%Y-%m")
                while cur_dt <= end_dt:
                    m_str = cur_dt.strftime("%Y-%m")
                    if m_str not in sorted_months:
                        missing_periods.append(m_str)
                    if cur_dt.month == 12:
                        cur_dt = cur_dt.replace(year=cur_dt.year + 1, month=1)
                    else:
                        cur_dt = cur_dt.replace(month=cur_dt.month + 1)
            except Exception as e:
                logger.warning(f"Date sequence gap error: {e}")

        # 4. Revenue Intelligence & Annualization
        annualized_business_receipts = true_business_receipts
        if coverage_months in range(1, 12):
            annualized_business_receipts = (true_business_receipts / Decimal(coverage_months)) * Decimal(12)

        # Fetch declared revenue from latest assessment
        declared_turnover: Optional[float] = None
        declared_debt: float = 0.0
        latest_assessment = (
            self.db.query(models.Assessment)
            .join(models.Business)
            .filter(models.Business.user_id == user_id)
            .order_by(models.Assessment.created_at.desc())
            .first()
        )
        if latest_assessment:
            declared_turnover = float(latest_assessment.annual_revenue)
            declared_debt = float(latest_assessment.existing_debt)

        # Fetch turnover from GST returns & P&L
        gst_turnover: Optional[float] = None
        pnl_revenue: Optional[float] = None
        cogs_amount: Optional[float] = None
        pnl_operating_expenses: Optional[float] = None
        current_assets: Optional[float] = None
        current_liabilities: Optional[float] = None

        gst_docs = [d for d in user_docs if (d.document_type or "").upper() == "GST_DOCUMENT"]
        for doc in gst_docs:
            ext = doc.extracted_data or {}
            val = ext.get("taxable_turnover") or ext.get("annual_revenue")
            if val:
                try:
                    gst_turnover = max(gst_turnover or 0.0, float(val))
                except (ValueError, TypeError):
                    pass

        pnl_docs = [
            d for d in user_docs
            if (d.document_type or "").upper() in ["PROFIT_LOSS", "INCOME_STATEMENT", "FINANCIAL_STATEMENTS"]
        ]
        for doc in pnl_docs:
            ext = doc.extracted_data or {}
            rev = ext.get("annual_revenue") or ext.get("operating_revenue") or ext.get("total_revenue")
            if rev:
                try:
                    pnl_revenue = max(pnl_revenue or 0.0, float(rev))
                except (ValueError, TypeError):
                    pass
            cogs = ext.get("cogs") or ext.get("cost_of_goods_sold")
            if cogs:
                try:
                    cogs_amount = float(cogs)
                except (ValueError, TypeError):
                    pass
            op_exp = ext.get("operating_expenses")
            if op_exp:
                try:
                    pnl_operating_expenses = float(op_exp)
                except (ValueError, TypeError):
                    pass

        bs_docs = [
            d for d in user_docs
            if (d.document_type or "").upper() in ["BALANCE_SHEET", "FINANCIAL_STATEMENTS"]
        ]
        for doc in bs_docs:
            ext = doc.extracted_data or {}
            ca = ext.get("current_assets")
            cl = ext.get("current_liabilities")
            if ca:
                try:
                    current_assets = float(ca)
                except (ValueError, TypeError):
                    pass
            if cl:
                try:
                    current_liabilities = float(cl)
                except (ValueError, TypeError):
                    pass

        # Variances
        ann_rec_float = float(annualized_business_receipts)
        rev_vs_declared_var: Optional[float] = None
        if declared_turnover and declared_turnover > 0:
            rev_vs_declared_var = round(((ann_rec_float - declared_turnover) / declared_turnover) * 100, 1)

        rev_vs_gst_var: Optional[float] = None
        if gst_turnover and gst_turnover > 0:
            rev_vs_gst_var = round(((ann_rec_float - gst_turnover) / gst_turnover) * 100, 1)

        rev_vs_pnl_var: Optional[float] = None
        if pnl_revenue and pnl_revenue > 0:
            rev_vs_pnl_var = round(((ann_rec_float - pnl_revenue) / pnl_revenue) * 100, 1)

        reconciliation_notes = []
        reconciliation_status = "MATCHED"

        if rev_vs_declared_var is not None and abs(rev_vs_declared_var) > 20:
            reconciliation_status = "DIVERGENT"
            reconciliation_notes.append(
                f"Variance of {abs(rev_vs_declared_var)}% between annualized bank receipts (₹{ann_rec_float:,.0f}) and declared turnover (₹{declared_turnover:,.0f})."
            )
        if rev_vs_gst_var is not None and abs(rev_vs_gst_var) > 15:
            reconciliation_status = "DIVERGENT"
            reconciliation_notes.append(
                f"GST turnover variance of {abs(rev_vs_gst_var)}% between bank deposits and filed GSTR taxable turnover."
            )
        if internal_transfers > 0:
            reconciliation_notes.append(
                f"Identified ₹{float(internal_transfers):,.0f} in internal contra transfers across applicant accounts, excluded from true sales receipts."
            )
        if not reconciliation_notes:
            reconciliation_notes.append("Bank business receipts, declared revenue, and supporting filings are consistent within expected variance.")

        # 5. Expense & Profitability
        total_reported_expenses = gross_debits - internal_transfers
        operating_cash_flow_estimate = true_business_receipts - total_reported_expenses

        gross_profit = None
        gross_margin_pct = None
        if pnl_revenue and cogs_amount:
            gross_profit = round(pnl_revenue - cogs_amount, 2)
            gross_margin_pct = round((gross_profit / max(1.0, pnl_revenue)) * 100, 1)

        operating_profit = None
        operating_margin_pct = None
        if gross_profit is not None and pnl_operating_expenses is not None:
            operating_profit = round(gross_profit - pnl_operating_expenses, 2)
            operating_margin_pct = round((operating_profit / max(1.0, pnl_revenue or 1.0)) * 100, 1)

        # 6. Liquidity Indicators
        current_ratio = None
        working_capital = None
        cash_to_current_liabilities = None
        liquidity_limitations = ""

        if current_assets is not None and current_liabilities is not None:
            if current_liabilities > 0:
                current_ratio = round(current_assets / current_liabilities, 2)
                if latest_closing_balance is not None:
                    cash_to_current_liabilities = round(latest_closing_balance / current_liabilities, 2)
            else:
                current_ratio = 99.0
            working_capital = round(current_assets - current_liabilities, 2)
        else:
            liquidity_limitations = "Requires audited Balance Sheet document with current assets and liabilities."

        # 7. Debt & Repayment Indicators
        observed_emis_float = float(loan_emis_total)
        monthly_emi_run_rate = round(observed_emis_float / max(1, coverage_months), 2)
        annual_debt_service = monthly_emi_run_rate * 12

        cash_flow_debt_service_cov = None
        if annual_debt_service > 0:
            cash_flow_debt_service_cov = round(float(operating_cash_flow_estimate) / annual_debt_service, 2)

        dscr = None
        if annual_debt_service > 0 and float(operating_cash_flow_estimate) > 0:
            dscr = round(float(operating_cash_flow_estimate) / annual_debt_service, 2)

        # 8. Data Quality & Discrepancies
        discrepancies: List[Dict[str, Any]] = []

        # Check duplicate statement files
        duplicate_files = self.detect_duplicate_files(user_id, docs=user_docs)
        for df in duplicate_files:
            discrepancies.append({
                "code": "DUPLICATE_DOCUMENT",
                "title": "Duplicate Statement File Uploaded",
                "severity": "MEDIUM",
                "affected_field": "statement_document",
                "expected": "Unique statement per period",
                "observed": f"Duplicate file {df['duplicate_filename']}",
                "doc_id": df["duplicate_id"],
                "period": "N/A",
                "explanation": f"File hash {df['file_hash'][:12]} matches previously uploaded document #{df['original_id']}."
            })

        # Check duplicate transactions
        duplicate_txs = self.detect_duplicate_transactions(user_id, accounts=accounts, transactions=transactions)
        if duplicate_txs:
            discrepancies.append({
                "code": "DUPLICATE_TRANSACTIONS",
                "title": "Suspected Duplicate Transactions",
                "severity": "MEDIUM",
                "affected_field": "transactions",
                "expected": "Unique transaction entries",
                "observed": f"{len(duplicate_txs)} duplicate entries detected",
                "doc_id": None,
                "period": f"{duplicate_txs[0]['transaction_date']}",
                "explanation": "Identical transaction entries detected across statement files."
            })

        # Check statement gap
        if missing_periods:
            discrepancies.append({
                "code": "STATEMENT_PERIOD_GAP",
                "title": "Missing Statement Sequence Periods",
                "severity": "HIGH",
                "affected_field": "reporting_periods",
                "expected": "Continuous sequential monthly statements",
                "observed": f"Missing: {', '.join(missing_periods)}",
                "doc_id": None,
                "period": f"{sorted_months[0]} to {sorted_months[-1]}",
                "explanation": "Bank statement uploads skip months in the reporting timeline."
            })

        # Check arithmetic consistency on accounts
        for acc in accounts:
            summary = acc.extracted_summary or {}
            if not summary.get("arithmetic_consistent", True):
                delta = summary.get("arithmetic_delta", 0.0)
                discrepancies.append({
                    "code": "ARITHMETIC_INCONSISTENCY",
                    "title": f"Arithmetic Inconsistency in {acc.bank_name}",
                    "severity": "HIGH",
                    "affected_field": f"account_{acc.id}_balance",
                    "expected": "Opening + Credits - Debits = Closing",
                    "observed": f"Delta of ₹{delta:,.2f}",
                    "doc_id": acc.statement_document_id,
                    "period": summary.get("reporting_period", "Unknown"),
                    "explanation": f"Statement transactions do not reconcile with stated opening and closing balances by ₹{delta:,.2f}."
                })

        # Check revenue divergence
        if rev_vs_declared_var is not None and abs(rev_vs_declared_var) > 20:
            discrepancies.append({
                "code": "REVENUE_MISMATCH",
                "title": "Turnover Reconciliation Variance",
                "severity": "HIGH" if abs(rev_vs_declared_var) > 35 else "MEDIUM",
                "affected_field": "annual_revenue",
                "expected": f"₹{declared_turnover:,.0f} (Declared)",
                "observed": f"₹{ann_rec_float:,.0f} (Bank receipts)",
                "doc_id": None,
                "period": "Annualized",
                "difference_amount": abs(ann_rec_float - (declared_turnover or 0.0)),
                "difference_percentage": abs(rev_vs_declared_var),
                "explanation": f"Annualized bank sales receipts diverge by {abs(rev_vs_declared_var)}% from declared turnover."
            })

        # Compute 4-dimensional Data Quality Score
        # Dimension 1: Completeness (30%) - target 6+ months, continuous
        c_score = min(30.0, (coverage_months / 6.0) * 25.0)
        if not missing_periods and coverage_months >= 3:
            c_score += 5.0

        # Dimension 2: Consistency (25%) - arithmetic & no duplicates
        consist_score = 25.0
        if any(d["code"] == "ARITHMETIC_INCONSISTENCY" for d in discrepancies):
            consist_score -= 10.0
        if any(d["code"] == "DUPLICATE_TRANSACTIONS" for d in discrepancies):
            consist_score -= 5.0

        # Dimension 3: Source Reliability (25%) - verified accounts & documents
        source_score = 15.0
        if len(accounts) > 0 and all(a.verification_status in ["VERIFIED", "UPLOADED"] for a in accounts):
            source_score += 10.0

        # Dimension 4: Reconciliation (20%) - declared vs bank
        recon_score = 20.0
        if rev_vs_declared_var is not None:
            if abs(rev_vs_declared_var) > 35:
                recon_score -= 12.0
            elif abs(rev_vs_declared_var) > 20:
                recon_score -= 6.0

        overall_dq_score = round(max(0.0, min(100.0, c_score + consist_score + source_score + recon_score)), 1)
        dq_tier = "EXCELLENT" if overall_dq_score >= 85 else "GOOD" if overall_dq_score >= 70 else "FAIR" if overall_dq_score >= 50 else "POOR"

        # 9. Sync Discrepancies with Database
        # 9. Sync Discrepancies with Database using single bulk lookup
        existing_discs_list = self.db.query(models.FinancialDiscrepancy).filter(
            models.FinancialDiscrepancy.user_id == user_id,
            models.FinancialDiscrepancy.verification_status == "OPEN"
        ).all()
        existing_discs = {d.discrepancy_code: d for d in existing_discs_list}

        has_new_discs = False
        for disc in discrepancies:
            existing = existing_discs.get(disc["code"])
            if not existing:
                new_disc = models.FinancialDiscrepancy(
                    user_id=user_id,
                    business_id=b_id,
                    discrepancy_code=disc["code"],
                    title=disc["title"],
                    severity=disc["severity"],
                    affected_field=disc["affected_field"],
                    expected_value=disc["expected"],
                    observed_value=disc["observed"],
                    source_document_id=disc.get("doc_id"),
                    reporting_period=disc.get("period"),
                    difference_amount=disc.get("difference_amount"),
                    difference_percentage=disc.get("difference_percentage"),
                    detection_rule=disc["code"],
                    explanation=disc["explanation"],
                    verification_status="OPEN"
                )
                self.db.add(new_disc)
                existing_discs[disc["code"]] = new_disc
                has_new_discs = True

        # 10. Save Core Financial Metrics with Provenance using single bulk lookup
        metrics_to_upsert = [
            ("total_credits", "Total Account Credits", float(gross_credits), "INR", "CALCULATED", "Sum of all incoming bank transactions"),
            ("total_debits", "Total Account Debits", float(gross_debits), "INR", "CALCULATED", "Sum of all outgoing bank debits"),
            ("internal_transfers", "Contra / Internal Transfers", float(internal_transfers), "INR", "CALCULATED", "Matched contra transfers between own accounts"),
            ("business_receipts", "Identified Business Sales Receipts", float(true_business_receipts), "INR", "CALCULATED", "Gross credits minus contra transfers, loans, and refunds"),
            ("annualized_business_receipts", "Annualized Business Receipts", float(annualized_business_receipts), "INR", "ESTIMATED", "Business receipts projected across 12-month baseline"),
            ("net_cash_flow", "Net Cash Movement", float(net_cash_flow), "INR", "CALCULATED", "Total credits minus total debits"),
            ("operating_cash_flow_estimate", "Operating Cash Flow Estimate", float(operating_cash_flow_estimate), "INR", "ESTIMATED", "True receipts minus categorized operating expenses"),
            ("cash_flow_volatility", "Cash Flow Volatility", float(volatility), "RATIO", "CALCULATED", "Std deviation divided by mean monthly net cash flow"),
            ("debt_service_burden_monthly", "Observed Monthly Debt Service", float(monthly_emi_run_rate), "INR", "CALCULATED", "Observed recurring loan EMIs per month"),
            ("data_quality_score", "Financial Data Quality Score", float(overall_dq_score), "SCORE", "CALCULATED", "Composite 4-dimensional data reliability index")
        ]

        existing_metrics_list = self.db.query(models.FinancialMetricRecord).filter(
            models.FinancialMetricRecord.user_id == user_id
        ).all()
        existing_metrics = {m.metric_key: m for m in existing_metrics_list}

        metrics_changed = False
        for m_key, m_name, m_val, m_unit, m_prov, m_formula in metrics_to_upsert:
            existing_m = existing_metrics.get(m_key)
            if existing_m:
                if (existing_m.calculated_value != m_val or
                    existing_m.is_stale or
                    existing_m.formula != m_formula or
                    existing_m.metric_name != m_name or
                    existing_m.unit != m_unit or
                    existing_m.provenance_type != m_prov):
                    existing_m.calculated_value = m_val
                    existing_m.metric_name = m_name
                    existing_m.unit = m_unit
                    existing_m.provenance_type = m_prov
                    existing_m.formula = m_formula
                    existing_m.is_stale = False
                    existing_m.period_start = sorted_months[0] if sorted_months else None
                    existing_m.period_end = sorted_months[-1] if sorted_months else None
                    existing_m.updated_at = datetime.datetime.utcnow()
                    metrics_changed = True
            else:
                new_m = models.FinancialMetricRecord(
                    user_id=user_id,
                    business_id=b_id,
                    metric_key=m_key,
                    metric_name=m_name,
                    calculated_value=m_val,
                    unit=m_unit,
                    period_start=sorted_months[0] if sorted_months else None,
                    period_end=sorted_months[-1] if sorted_months else None,
                    formula=m_formula,
                    provenance_type=m_prov,
                    data_completeness="COMPLETE" if not missing_periods else "PARTIAL",
                    source_records_summary={"contributing_accounts": acc_ids, "transaction_count": len(transactions)}
                )
                self.db.add(new_m)
                existing_metrics[m_key] = new_m
                metrics_changed = True

        completed_at = datetime.datetime.utcnow()
        is_read_only = trigger_source in ("SUMMARY_FETCH", "READ_ONLY")

        # 11. Record Analysis Run (only when mutating calculation requested)
        if not is_read_only:
            analysis_run = models.FinancialAnalysisRun(
                user_id=user_id,
                business_id=b_id,
                status="COMPLETED",
                trigger_source=trigger_source,
                summary={
                    "accounts_analyzed": len(accounts),
                    "transactions_processed": len(transactions),
                    "true_receipts": float(true_business_receipts),
                    "net_flow": float(net_cash_flow),
                    "coverage_months": coverage_months
                },
                data_quality_score=overall_dq_score,
                data_quality_breakdown={
                    "completeness": round(c_score, 1),
                    "consistency": round(consist_score, 1),
                    "source_reliability": round(source_score, 1),
                    "reconciliation": round(recon_score, 1),
                    "tier": dq_tier
                },
                started_at=started_at,
                completed_at=completed_at
            )
            self.db.add(analysis_run)
            self.db.commit()
        elif has_new_discs or metrics_changed:
            self.db.commit()

        # Count open discrepancies from in-memory dictionary
        open_disc_count = len(existing_discs)

        return {
            "business_id": b_id,
            "business_name": biz.name if biz else None,
            "user_id": user_id,
            "accounts_count": len(accounts),
            "statement_coverage_months": coverage_months,
            "reporting_period": f"{sorted_months[0]} to {sorted_months[-1]}" if sorted_months else "Insufficient Data",
            "missing_periods": missing_periods,
            "has_coverage_gaps": len(missing_periods) > 0,
            "cash_flow": {
                "total_credits": round_curr(gross_credits),
                "total_debits": round_curr(gross_debits),
                "net_cash_flow": round_curr(net_cash_flow),
                "operating_cash_flow_estimate": round_curr(operating_cash_flow_estimate),
                "monthly_average_net_flow": round_curr(net_cash_flow / Decimal(max(1, coverage_months))),
                "cash_flow_volatility": volatility,
                "positive_flow_months": positive_flow_months,
                "negative_flow_months": negative_flow_months,
                "average_closing_balance": avg_closing_balance,
                "latest_closing_balance": latest_closing_balance,
                "provenance": "CALCULATED",
                "limitations": "Reflects banking transactional streams only. Does not record cash collections unbanked."
            },
            "revenue": {
                "declared_turnover": declared_turnover,
                "supporting_records_turnover": gst_turnover or pnl_revenue,
                "identified_business_receipts": round_curr(true_business_receipts),
                "annualized_business_receipts": round_curr(annualized_business_receipts),
                "revenue_vs_declared_variance_pct": rev_vs_declared_var,
                "revenue_vs_gst_variance_pct": rev_vs_gst_var,
                "revenue_vs_pnl_variance_pct": rev_vs_pnl_var,
                "reconciliation_status": reconciliation_status,
                "reconciliation_notes": reconciliation_notes
            },
            "expenses_profitability": {
                "total_reported_expenses": round_curr(total_reported_expenses),
                "categorized_expenses": {k: round_curr(v) for k, v in categorized_expenses.items()},
                "gross_profit": gross_profit,
                "gross_margin_pct": gross_margin_pct,
                "operating_profit": operating_profit,
                "operating_margin_pct": operating_margin_pct,
                "net_profit_estimate": round_curr(operating_cash_flow_estimate),
                "net_profit_margin_pct": round(float(operating_cash_flow_estimate / max(Decimal(1), true_business_receipts)) * 100, 1) if true_business_receipts > 0 else None,
                "provenance": "CALCULATED_ESTIMATE",
                "limitations": "Operating profit and margin estimates require formal audited Profit & Loss statements for GAAP precision."
            },
            "liquidity": {
                "current_ratio": current_ratio,
                "working_capital": working_capital,
                "cash_to_current_liabilities_ratio": cash_to_current_liabilities,
                "liquidity_assessment": "Adequate" if current_ratio and current_ratio >= 1.2 else "Review Needed" if current_ratio else "Insufficient data",
                "formula": "Current Assets / Current Liabilities",
                "limitations": liquidity_limitations or "Calculated directly from uploaded verified Balance Sheet."
            },
            "debt_repayment": {
                "identified_existing_debt": round_curr(declared_debt),
                "observed_loan_emis_total": round_curr(loan_emis_total),
                "monthly_debt_service_burden": monthly_emi_run_rate,
                "annual_debt_service_burden": round_curr(annual_debt_service),
                "cash_flow_debt_service_coverage": cash_flow_debt_service_cov,
                "dscr": dscr,
                "debt_evidence_summary": f"Observed ₹{monthly_emi_run_rate:,.2f}/mo in active debt repayments across statements.",
                "limitations": "Obligations inferred from automated bank debit classifications. May exclude unrecorded director loans."
            },
            "monthly_trends": monthly_trends,
            "data_quality": {
                "overall_score": overall_dq_score,
                "tier": dq_tier,
                "completeness_score": round(c_score, 1),
                "consistency_score": round(consist_score, 1),
                "source_reliability_score": round(source_score, 1),
                "reconciliation_score": round(recon_score, 1),
                "quality_factors": [
                    {"dimension": "Completeness", "score": round(c_score, 1), "max": 30.0, "status": "Pass" if c_score >= 20 else "Warning"},
                    {"dimension": "Consistency", "score": round(consist_score, 1), "max": 25.0, "status": "Pass" if consist_score >= 20 else "Warning"},
                    {"dimension": "Source Reliability", "score": round(source_score, 1), "max": 25.0, "status": "Pass" if source_score >= 20 else "Warning"},
                    {"dimension": "Reconciliation", "score": round(recon_score, 1), "max": 20.0, "status": "Pass" if recon_score >= 15 else "Warning"}
                ],
                "limitations_and_disclosures": [
                    f"Statement spans {coverage_months} reporting month(s).",
                    f"{len(accounts)} registered business bank account(s) included.",
                    "Internal contra transfers excluded to guarantee anti-double counting."
                ]
            },
            "open_discrepancies_count": open_disc_count,
            "last_recalculated_at": completed_at.isoformat(),
            "disclosures": {
                "engine_version": "2.0.0-PROD",
                "charter": "Advisory financial intelligence for underwriting decision-support. Does not render autonomous credit decisions.",
                "reconciliation_rule": "GSTR taxable revenue and audited P&L operating turnover serve as ground truth against bank statement receipts."
            }
        }

    def override_transaction_category(
        self,
        transaction_id: int,
        new_category: str,
        reason: str,
        analyst_uid: str
    ) -> models.BankTransaction:
        """Allows authorized credit analyst to correct transaction classification with immutable audit trail."""
        tx = self.db.query(models.BankTransaction).filter(models.BankTransaction.id == transaction_id).first()
        if not tx:
            raise ValueError(f"Transaction #{transaction_id} not found.")

        prev_cat = tx.analyst_category_override or tx.category
        tx.analyst_category_override = new_category.strip()
        tx.analyst_reviewed = True

        # If reclassified to own_account_transfer, update internal transfer flag
        if new_category == "own_account_transfer":
            tx.is_internal_transfer = True
            tx.transfer_confidence = 1.0
        elif prev_cat == "own_account_transfer" and new_category != "own_account_transfer":
            tx.is_internal_transfer = False

        account = self.db.query(models.BankAccount).filter(models.BankAccount.id == tx.bank_account_id).first()
        user_id = account.user_id if account else "unknown"

        # Log audit
        audit = models.TransactionClassificationAudit(
            transaction_id=tx.id,
            user_id=user_id,
            previous_category=prev_cat,
            new_category=new_category,
            reason=reason.strip(),
            performed_by=analyst_uid
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(tx)

        # Trigger financial recalculation to reflect reclassified cash flow
        if account:
            self.calculate_financial_intelligence(account.user_id, account.business_id, trigger_source="CLASSIFICATION_OVERRIDE")

        return tx

    def resolve_discrepancy(
        self,
        discrepancy_id: int,
        status: str,
        notes: str,
        analyst_uid: str
    ) -> models.FinancialDiscrepancy:
        """Resolves a detected financial discrepancy with evidence and notes."""
        disc = self.db.query(models.FinancialDiscrepancy).filter(models.FinancialDiscrepancy.id == discrepancy_id).first()
        if not disc:
            raise ValueError(f"Discrepancy #{discrepancy_id} not found.")

        disc.verification_status = status.strip().upper()
        disc.analyst_resolution = notes.strip()
        disc.resolved_by = analyst_uid
        disc.resolved_at = datetime.datetime.utcnow()
        self.db.commit()
        self.db.refresh(disc)
        return disc

    def get_discrepancies(
        self,
        user_id: str,
        business_id: Optional[int] = None,
        status_filter: Optional[str] = None
    ) -> List[models.FinancialDiscrepancy]:
        """Lists financial discrepancies for the applicant."""
        q = self.db.query(models.FinancialDiscrepancy).filter(models.FinancialDiscrepancy.user_id == user_id)
        if business_id:
            q = q.filter(models.FinancialDiscrepancy.business_id == business_id)
        if status_filter:
            q = q.filter(models.FinancialDiscrepancy.verification_status == status_filter.upper())
        return q.order_by(models.FinancialDiscrepancy.created_at.desc()).all()

    def get_provenance_registry(self, user_id: str) -> List[models.FinancialMetricRecord]:
        """Returns provenance metadata for all calculated financial metrics."""
        return self.db.query(models.FinancialMetricRecord).filter(
            models.FinancialMetricRecord.user_id == user_id
        ).order_by(models.FinancialMetricRecord.created_at.desc()).all()
