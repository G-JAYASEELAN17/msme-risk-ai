
"""Repair defaults on intelligence tables."""

from alembic import op
import sqlalchemy as sa

# Revision identifiers
revision = "77fd0f49d2d8"
down_revision = "i1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Financial intelligence tables
    op.alter_column(
        "financial_metric_records", "unit",
        existing_type=sa.String(),
        server_default=sa.text("'INR'")
    )
    op.alter_column(
        "financial_metric_records", "provenance_type",
        existing_type=sa.String(),
        server_default=sa.text("'CALCULATED'")
    )
    op.alter_column(
        "financial_metric_records", "data_completeness",
        existing_type=sa.String(),
        server_default=sa.text("'COMPLETE'")
    )
    op.alter_column(
        "financial_metric_records", "is_stale",
        existing_type=sa.Boolean(),
        server_default=sa.text("false")
    )
    op.alter_column(
        "financial_metric_records", "created_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )
    op.alter_column(
        "financial_metric_records", "updated_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )

    op.alter_column(
        "financial_discrepancies", "severity",
        existing_type=sa.String(),
        server_default=sa.text("'MEDIUM'")
    )
    op.alter_column(
        "financial_discrepancies", "verification_status",
        existing_type=sa.String(),
        server_default=sa.text("'OPEN'")
    )
    op.alter_column(
        "financial_discrepancies", "created_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )

    op.alter_column(
        "financial_analysis_runs", "status",
        existing_type=sa.String(),
        server_default=sa.text("'COMPLETED'")
    )
    op.alter_column(
        "financial_analysis_runs", "trigger_source",
        existing_type=sa.String(),
        server_default=sa.text("'MANUAL'")
    )
    op.alter_column(
        "financial_analysis_runs", "data_quality_score",
        existing_type=sa.Float(),
        server_default=sa.text("100.0")
    )
    op.alter_column(
        "financial_analysis_runs", "started_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )
    op.alter_column(
        "transaction_classification_audits", "created_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )

    # Explainable AI tables
    op.alter_column(
        "model_explanations", "explainer_type",
        existing_type=sa.String(),
        server_default=sa.text("'TreeSHAP'")
    )
    op.alter_column(
        "model_explanations", "output_space",
        existing_type=sa.String(),
        server_default=sa.text("'log-odds'")
    )
    op.alter_column(
        "model_explanations", "explanation_status",
        existing_type=sa.String(),
        server_default=sa.text("'AVAILABLE'")
    )
    op.alter_column(
        "model_explanations", "created_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )

    op.alter_column(
        "global_importance_snapshots", "shap_aggregation_method",
        existing_type=sa.String(),
        server_default=sa.text("'mean_absolute'")
    )
    op.alter_column(
        "global_importance_snapshots", "is_valid",
        existing_type=sa.Boolean(),
        server_default=sa.text("true")
    )
    op.alter_column(
        "global_importance_snapshots", "created_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )

    op.alter_column(
        "counterfactual_simulations", "status",
        existing_type=sa.String(),
        server_default=sa.text("'FOUND'")
    )
    op.alter_column(
        "counterfactual_simulations", "created_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )

    # Credit decision and governance tables
    op.alter_column(
        "credit_policies", "is_active",
        existing_type=sa.Boolean(),
        server_default=sa.text("true")
    )
    op.alter_column(
        "credit_policies", "created_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )

    op.alter_column(
        "policy_evaluations", "overall_status",
        existing_type=sa.String(),
        server_default=sa.text("'PASS'")
    )
    for column in ("passed_count", "failed_count", "review_required_count"):
        op.alter_column(
            "policy_evaluations", column,
            existing_type=sa.Integer(),
            server_default=sa.text("0")
        )
    op.alter_column(
        "policy_evaluations", "evaluated_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )

    op.alter_column(
        "credit_reviews", "created_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )

    op.alter_column(
        "decision_overrides", "approval_status",
        existing_type=sa.String(),
        server_default=sa.text("'APPROVED'")
    )
    op.alter_column(
        "decision_overrides", "created_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )

    op.alter_column(
        "model_registry_records", "is_active",
        existing_type=sa.Boolean(),
        server_default=sa.text("false")
    )
    op.alter_column(
        "model_registry_records", "deployment_status",
        existing_type=sa.String(),
        server_default=sa.text("'ACTIVE'")
    )
    op.alter_column(
        "model_registry_records", "registered_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )

    op.alter_column(
        "model_drift_snapshots", "evaluation_window_days",
        existing_type=sa.Integer(),
        server_default=sa.text("30")
    )
    op.alter_column(
        "model_drift_snapshots", "overall_drift_status",
        existing_type=sa.String(),
        server_default=sa.text("'NO_DRIFT'")
    )
    op.alter_column(
        "model_drift_snapshots", "created_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )

    op.alter_column(
        "governance_alerts", "severity",
        existing_type=sa.String(),
        server_default=sa.text("'WARNING'")
    )
    op.alter_column(
        "governance_alerts", "status",
        existing_type=sa.String(),
        server_default=sa.text("'OPEN'")
    )
    op.alter_column(
        "governance_alerts", "created_at",
        existing_type=sa.DateTime(),
        server_default=sa.func.now()
    )


def downgrade() -> None:
    # Remove only the defaults added by this migration.
    # Existing tables, rows, columns, and indexes remain intact.
    defaults = {
        "financial_metric_records": [
            ("unit", sa.String()),
            ("provenance_type", sa.String()),
            ("data_completeness", sa.String()),
            ("is_stale", sa.Boolean()),
            ("created_at", sa.DateTime()),
            ("updated_at", sa.DateTime()),
        ],
        "financial_discrepancies": [
            ("severity", sa.String()),
            ("verification_status", sa.String()),
            ("created_at", sa.DateTime()),
        ],
        "financial_analysis_runs": [
            ("status", sa.String()),
            ("trigger_source", sa.String()),
            ("data_quality_score", sa.Float()),
            ("started_at", sa.DateTime()),
        ],
        "transaction_classification_audits": [
            ("created_at", sa.DateTime()),
        ],
        "model_explanations": [
            ("explainer_type", sa.String()),
            ("output_space", sa.String()),
            ("explanation_status", sa.String()),
            ("created_at", sa.DateTime()),
        ],
        "global_importance_snapshots": [
            ("shap_aggregation_method", sa.String()),
            ("is_valid", sa.Boolean()),
            ("created_at", sa.DateTime()),
        ],
        "counterfactual_simulations": [
            ("status", sa.String()),
            ("created_at", sa.DateTime()),
        ],
        "credit_policies": [
            ("is_active", sa.Boolean()),
            ("created_at", sa.DateTime()),
        ],
        "policy_evaluations": [
            ("overall_status", sa.String()),
            ("passed_count", sa.Integer()),
            ("failed_count", sa.Integer()),
            ("review_required_count", sa.Integer()),
            ("evaluated_at", sa.DateTime()),
        ],
        "credit_reviews": [("created_at", sa.DateTime())],
        "decision_overrides": [
            ("approval_status", sa.String()),
            ("created_at", sa.DateTime()),
        ],
        "model_registry_records": [
            ("is_active", sa.Boolean()),
            ("deployment_status", sa.String()),
            ("registered_at", sa.DateTime()),
        ],
        "model_drift_snapshots": [
            ("evaluation_window_days", sa.Integer()),
            ("overall_drift_status", sa.String()),
            ("created_at", sa.DateTime()),
        ],
        "governance_alerts": [
            ("severity", sa.String()),
            ("status", sa.String()),
            ("created_at", sa.DateTime()),
        ],
    }

    for table, columns in defaults.items():
        for column, column_type in columns:
            op.alter_column(
                table,
                column,
                existing_type=column_type,
                server_default=None,
            )
