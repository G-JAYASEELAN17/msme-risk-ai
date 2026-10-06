import logging
from typing import Dict, Any, List, Optional, Tuple
import numpy as np

logger = logging.getLogger("risk_intelligence")

class RiskIntelligenceService:
    """
    Core engine for explainable risk scoring, factor categorization,
    data quality auditing, and deterministic underwriting summaries.
    """

    @staticmethod
    def calculate_data_quality_score(data_dict: Dict[str, Any]) -> Tuple[float, str, List[str]]:
        """
        Calculates a data quality score (0–100) and auditing notes.
        Considers missing values, extreme ratios, and alternative signal coverage.
        """
        score = 100.0
        notes = []

        rev = float(data_dict.get("annual_revenue") or 0)
        cf = float(data_dict.get("monthly_cash_flow") or 0)
        exp = float(data_dict.get("monthly_expenses") or 0)
        debt = float(data_dict.get("existing_debt") or 0)
        age = int(data_dict.get("age") or 0)
        employees = int(data_dict.get("employees") or 0)
        txns = int(data_dict.get("digital_transactions") or 0)
        util_score = float(data_dict.get("utility_payment_score") or 0)
        inv_score = float(data_dict.get("invoice_payment_score") or 0)

        # 1. Critical Revenue & Operating Cash Flow checks
        if rev <= 0:
            score -= 25.0
            notes.append("Zero or missing annual revenue reported.")
        elif rev < 50000:
            score -= 5.0
            notes.append("Micro revenue below standard commercial threshold.")

        if exp <= 0:
            score -= 15.0
            notes.append("Zero monthly operating expenditure reported.")

        # 2. Leverage checks
        if rev > 0 and (debt / rev) > 8.0:
            score -= 10.0
            notes.append("Extreme debt-to-revenue multiple exceeding 8x.")

        # 3. Operational scale
        if age <= 0:
            score -= 8.0
            notes.append("Business age is less than 1 year.")

        if employees <= 0:
            score -= 5.0
            notes.append("Zero employee count.")

        # 4. Alternative telemetry coverage
        if txns <= 0:
            score -= 6.0
            notes.append("Digital transaction telemetry unrecorded.")

        if util_score <= 0 or inv_score <= 0:
            score -= 6.0
            notes.append("Incomplete alternative bill or invoice fulfillment score.")

        score = float(np.clip(score, 20.0, 100.0))
        score = round(score, 1)

        if score >= 85.0:
            tier = "High Quality"
        elif score >= 70.0:
            tier = "Medium Quality"
        else:
            tier = "Low Quality"

        return score, tier, notes

    @staticmethod
    def calculate_risk_score(probability: float) -> float:
        """
        Calculates a normalized 0–100 Risk Score from Default Probability (0-100%).
        Aligned with institutional underwriting bands:
        - 0–24: LOW
        - 25–55: MEDIUM
        - 56–100: HIGH
        """
        prob = float(np.clip(probability, 0.0, 100.0))
        return round(prob, 1)

    @staticmethod
    def categorize_factors(data_dict: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Groups explainable underwriting factors across 7 standardized dimensions:
        - Financial Strength
        - Cash Flow
        - Debt Burden
        - Revenue Stability
        - Transaction Behaviour
        - Payment Behaviour
        - Alternative Signals
        """
        rev = float(data_dict.get("annual_revenue") or 1)
        cf = float(data_dict.get("monthly_cash_flow") or 0)
        exp = float(data_dict.get("monthly_expenses") or 1)
        debt = float(data_dict.get("existing_debt") or 0)
        age = int(data_dict.get("age") or 0)
        employees = int(data_dict.get("employees") or 0)
        txns = int(data_dict.get("digital_transactions") or 0)
        util = float(data_dict.get("utility_payment_score") or 0)
        inv = float(data_dict.get("invoice_payment_score") or 0)
        defaults = int(data_dict.get("previous_defaults") or 0)

        categories: Dict[str, List[Dict[str, Any]]] = {
            "Financial Strength": [],
            "Cash Flow": [],
            "Debt Burden": [],
            "Revenue Stability": [],
            "Transaction Behaviour": [],
            "Payment Behaviour": [],
            "Alternative Signals": []
        }

        # 1. Financial Strength
        categories["Financial Strength"].append({
            "feature": "annual_revenue",
            "display_name": "Annual Revenue",
            "value": f"₹{rev:,.0f}",
            "impact": "High Impact" if rev > 1500000 else "Moderate Impact",
            "direction": "positive" if rev >= 1000000 else "negative",
            "explanation": f"Turnover scale of ₹{rev:,.0f} provides foundational solvency capacity."
        })

        # 2. Cash Flow
        cf_ratio = cf / max(exp, 1)
        categories["Cash Flow"].append({
            "feature": "monthly_cash_flow",
            "display_name": "Monthly Cash Flow Coverage",
            "value": f"{cf_ratio:.1%} of expenses",
            "impact": "High Impact",
            "direction": "positive" if cf > 0 and cf_ratio >= 0.20 else "negative",
            "explanation": (
                f"Net monthly cash buffer (₹{cf:,.0f}) covers {cf_ratio:.1%} of monthly expenditure."
                if cf > 0 else "Operating cash deficit impairs debt service capability."
            )
        })

        # 3. Debt Burden
        dtr = debt / max(rev, 1)
        categories["Debt Burden"].append({
            "feature": "debt_to_revenue",
            "display_name": "Debt-to-Revenue Leverage",
            "value": f"{dtr:.1%}",
            "impact": "High Impact",
            "direction": "positive" if dtr <= 0.25 else "negative",
            "explanation": (
                f"Low leverage burden of {dtr:.1%} preserves borrowing headroom."
                if dtr <= 0.25 else f"Elevated debt-to-revenue ratio of {dtr:.1%} increases default exposure."
            )
        })

        # 4. Revenue Stability
        categories["Revenue Stability"].append({
            "feature": "business_age",
            "display_name": "Operational Vintage",
            "value": f"{age} years ({employees} employees)",
            "impact": "Medium Impact",
            "direction": "positive" if age >= 3 else "negative",
            "explanation": (
                f"Established track record of {age} years reduces early-stage survival uncertainty."
                if age >= 3 else f"Early stage firm ({age} yr) carries heightened cyclical fragility."
            )
        })

        # 5. Transaction Behaviour
        categories["Transaction Behaviour"].append({
            "feature": "digital_transactions",
            "display_name": "Digital Payment Velocity",
            "value": f"{txns} txns/mo",
            "impact": "Moderate Impact",
            "direction": "positive" if txns >= 150 else "negative",
            "explanation": (
                f"High digital transaction volume ({txns}/mo) confirms active customer demand."
                if txns >= 150 else "Modest transaction velocity limits cash visibility."
            )
        })

        # 6. Payment Behaviour
        categories["Payment Behaviour"].append({
            "feature": "utility_and_invoice_score",
            "display_name": "Utility & Invoice Payment Discipline",
            "value": f"Utility: {util:.0f}/100, Invoice: {inv:.0f}/100",
            "impact": "Medium Impact",
            "direction": "positive" if (util >= 75 and inv >= 75) else "negative",
            "explanation": (
                "Timely supplier and utility settlements demonstrate operational fiscal discipline."
                if (util >= 75 and inv >= 75) else "Inconsistent payment scoring flags potential cash tight spots."
            )
        })

        # 7. Alternative Signals
        categories["Alternative Signals"].append({
            "feature": "previous_defaults",
            "display_name": "Historical Default Track Record",
            "value": f"{defaults} previous default(s)",
            "impact": "High Impact",
            "direction": "positive" if defaults == 0 else "negative",
            "explanation": (
                "Unblemished credit track record with zero historical defaults."
                if defaults == 0 else f"History of {defaults} default(s) heavily weighs upon credit scoring."
            )
        })

        return categories

    @staticmethod
    def generate_analyst_summary(
        business_name: str,
        risk_level: str,
        probability: float,
        risk_score: float,
        data_quality_score: float,
        positive_factors: List[str],
        risk_factors: List[str]
    ) -> str:
        """
        Builds a deterministic, natural language underwriting summary
        grounded entirely on factual model metrics and SHAP factors without external LLM hallucination.
        """
        pos_str = ", ".join(positive_factors[:2]) if positive_factors else "stable baseline parameters"
        risk_str = ", ".join(risk_factors[:2]) if risk_factors else "no acute credit hazards"

        return (
            f"Overall credit risk is evaluated as {risk_level} based on submitted financials for {business_name} "
            f"(Default Probability: {probability}%, Risk Score: {risk_score}/100). "
            f"Key positive signals driving this outcome are: {pos_str}. "
            f"The primary risk considerations identified: {risk_str}. "
            f"Data quality is rated at {data_quality_score}/100. "
            f"Decision-support memo generated for underwriter review; final determination requires authorized credit committee sign-off."
        )

    @staticmethod
    def calculate_risk_trend(
        current_prob: float,
        previous_prob: Optional[float]
    ) -> Dict[str, Any]:
        """Calculates risk trend comparing against previous prediction for same enterprise."""
        if previous_prob is None:
            return {
                "trend": "STABLE",
                "trend_label": "Baseline Established",
                "delta": 0.0,
                "description": "Initial assessment established for enterprise."
            }

        delta = round(current_prob - previous_prob, 1)

        if delta <= -2.0:
            trend = "IMPROVING"
            label = "Improving"
            desc = f"Default probability decreased by {abs(delta)} percentage points compared to prior assessment."
        elif delta >= 2.0:
            trend = "INCREASING_RISK"
            label = "Increasing Risk"
            desc = f"Default probability increased by {delta} percentage points compared to prior assessment."
        else:
            trend = "STABLE"
            label = "Stable"
            desc = "Default probability posture remains consistent with prior assessment."

        return {
            "trend": trend,
            "trend_label": label,
            "delta": delta,
            "description": desc
        }

risk_intelligence_service = RiskIntelligenceService()

# Module-level convenience functions
calculate_data_quality_score = RiskIntelligenceService.calculate_data_quality_score
calculate_risk_score = RiskIntelligenceService.calculate_risk_score
categorize_factors = RiskIntelligenceService.categorize_factors
generate_analyst_summary = RiskIntelligenceService.generate_analyst_summary
calculate_risk_trend = RiskIntelligenceService.calculate_risk_trend
compute_risk_trend = RiskIntelligenceService.calculate_risk_trend
