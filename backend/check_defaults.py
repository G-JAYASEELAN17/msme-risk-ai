from sqlalchemy import inspect
from app.database.database import engine

i = inspect(engine)

for table in [
    "financial_metric_records",
    "financial_discrepancies",
    "financial_analysis_runs",
    "transaction_classification_audits",
    "model_explanations",
    "global_importance_snapshots",
    "counterfactual_simulations",
    "credit_policies",
    "policy_evaluations",
    "credit_reviews",
    "decision_overrides",
    "model_registry_records",
    "model_drift_snapshots",
    "governance_alerts",
]:
    print(f"\n--- {table} ---")
    for c in i.get_columns(table):
        if c.get("default") is not None:
            print(f"{c['name']}: default={c['default']}")
