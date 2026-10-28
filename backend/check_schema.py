from sqlalchemy import inspect
from app.database.database import engine

tables = [
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
]

with engine.connect() as conn:
    inspector = inspect(conn)
    existing = set(inspector.get_table_names())

    for table in tables:
        print(f"\n{'=' * 50}\nTABLE: {table}")

        if table not in existing:
            print("MISSING TABLE")
            continue

        for column in inspector.get_columns(table):
            print(
                f"  {column['name']} | {column['type']} | "
                f"nullable={column['nullable']} | "
                f"default={column['default']}"
            )

        for index in inspector.get_indexes(table):
            print(
                f"  INDEX: {index['name']} | "
                f"columns={index['column_names']} | "
                f"unique={index['unique']}"
            )

        for fk in inspector.get_foreign_keys(table):
            print(
                f"  FK: {fk['constrained_columns']} -> "
                f"{fk['referred_table']}.{fk['referred_columns']}"
            )

print("\nRead-only schema inspection complete.")
