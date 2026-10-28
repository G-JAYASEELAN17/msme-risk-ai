from sqlalchemy import text
from app.database.database import engine

sql = text("""
SELECT
    table_name,
    column_name,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
      'financial_metric_records',
      'financial_discrepancies',
      'financial_analysis_runs',
      'transaction_classification_audits',
      'model_explanations',
      'global_importance_snapshots',
      'counterfactual_simulations',
      'credit_policies',
      'policy_evaluations',
      'credit_reviews',
      'decision_overrides',
      'model_registry_records',
      'model_drift_snapshots',
      'governance_alerts'
  )
ORDER BY table_name, ordinal_position
""")

with engine.connect() as conn:
    for row in conn.execute(sql):
        print(
            f"{row.table_name}.{row.column_name} | "
            f"default={row.column_default} | "
            f"nullable={row.is_nullable}"
        )
