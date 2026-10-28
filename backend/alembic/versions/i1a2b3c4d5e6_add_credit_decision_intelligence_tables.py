"""add_credit_decision_intelligence_tables

Revision ID: i1a2b3c4d5e6
Revises: h1a2b3c4d5e6
Create Date: 2026-10-22 09:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'i1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'h1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create credit decision intelligence and model governance tables and indexes."""
    conn = op.get_bind()
    existing_tables = []
    if conn is not None:
        try:
            inspector = inspect(conn)
            existing_tables = inspector.get_table_names()
        except Exception:
            existing_tables = []

    # 1. credit_policies
    if 'credit_policies' not in existing_tables:
        op.create_table(
            'credit_policies',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('policy_id', sa.String(), unique=True, nullable=False, index=True),
            sa.Column('version', sa.String(), nullable=False),
            sa.Column('name', sa.String(), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('rules', sa.JSON(), nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False, index=True),
            sa.Column('created_by', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, index=True),
        )

    # 2. policy_evaluations
    if 'policy_evaluations' not in existing_tables:
        op.create_table(
            'policy_evaluations',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('assessment_id', sa.Integer(), sa.ForeignKey('assessments.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('policy_id', sa.String(), nullable=False, index=True),
            sa.Column('policy_version', sa.String(), nullable=False),
            sa.Column('overall_status', sa.String(), server_default='PASS', nullable=False, index=True),
            sa.Column('passed_count', sa.Integer(), server_default='0', nullable=False),
            sa.Column('failed_count', sa.Integer(), server_default='0', nullable=False),
            sa.Column('review_required_count', sa.Integer(), server_default='0', nullable=False),
            sa.Column('rule_results', sa.JSON(), nullable=False),
            sa.Column('evaluated_by', sa.String(), nullable=True),
            sa.Column('evaluated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, index=True),
        )

    # 3. credit_reviews
    if 'credit_reviews' not in existing_tables:
        op.create_table(
            'credit_reviews',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('assessment_id', sa.Integer(), sa.ForeignKey('assessments.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('analyst_id', sa.String(), nullable=False, index=True),
            sa.Column('previous_status', sa.String(), nullable=True),
            sa.Column('new_status', sa.String(), nullable=False, index=True),
            sa.Column('action_type', sa.String(), nullable=False, index=True),
            sa.Column('recommendation', sa.String(), nullable=True),
            sa.Column('reason_code', sa.String(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('evidence_references', sa.JSON(), nullable=True),
            sa.Column('escalated_to', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, index=True),
        )

    # 4. decision_overrides
    if 'decision_overrides' not in existing_tables:
        op.create_table(
            'decision_overrides',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('assessment_id', sa.Integer(), sa.ForeignKey('assessments.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('actor_id', sa.String(), nullable=False, index=True),
            sa.Column('actor_role', sa.String(), nullable=False),
            sa.Column('original_model_output', sa.Float(), nullable=False),
            sa.Column('original_risk_band', sa.String(), nullable=False),
            sa.Column('final_decision', sa.String(), nullable=False),
            sa.Column('final_risk_band', sa.String(), nullable=False),
            sa.Column('override_type', sa.String(), nullable=False),
            sa.Column('reason_code', sa.String(), nullable=False),
            sa.Column('rationale', sa.Text(), nullable=False),
            sa.Column('evidence_references', sa.JSON(), nullable=True),
            sa.Column('policy_version', sa.String(), nullable=True),
            sa.Column('model_version', sa.String(), nullable=False),
            sa.Column('approval_status', sa.String(), server_default='APPROVED', nullable=False, index=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, index=True),
        )

    # 5. model_registry_records
    if 'model_registry_records' not in existing_tables:
        op.create_table(
            'model_registry_records',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('model_id', sa.String(), nullable=False, index=True),
            sa.Column('model_version', sa.String(), unique=True, nullable=False, index=True),
            sa.Column('algorithm', sa.String(), nullable=False),
            sa.Column('artifact_fingerprint', sa.String(), nullable=False),
            sa.Column('schema_fingerprint', sa.String(), nullable=False),
            sa.Column('preprocessing_version', sa.String(), nullable=False),
            sa.Column('training_samples', sa.Integer(), nullable=False),
            sa.Column('test_samples', sa.Integer(), nullable=False),
            sa.Column('validation_metrics', sa.JSON(), nullable=False),
            sa.Column('feature_schema', sa.JSON(), nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default='false', nullable=False, index=True),
            sa.Column('deployment_status', sa.String(), server_default='ACTIVE', nullable=False, index=True),
            sa.Column('known_limitations', sa.JSON(), nullable=True),
            sa.Column('registered_by', sa.String(), nullable=True),
            sa.Column('registered_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, index=True),
        )

    # 6. model_drift_snapshots
    if 'model_drift_snapshots' not in existing_tables:
        op.create_table(
            'model_drift_snapshots',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('model_version', sa.String(), nullable=False, index=True),
            sa.Column('reference_dataset', sa.String(), nullable=False),
            sa.Column('observation_count', sa.Integer(), nullable=False),
            sa.Column('evaluation_window_days', sa.Integer(), server_default='30', nullable=False),
            sa.Column('overall_drift_status', sa.String(), server_default='NO_DRIFT', nullable=False, index=True),
            sa.Column('mean_psi', sa.Float(), nullable=True),
            sa.Column('feature_drift_metrics', sa.JSON(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, index=True),
        )

    # 7. governance_alerts
    if 'governance_alerts' not in existing_tables:
        op.create_table(
            'governance_alerts',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('alert_type', sa.String(), nullable=False, index=True),
            sa.Column('severity', sa.String(), server_default='WARNING', nullable=False, index=True),
            sa.Column('title', sa.String(), nullable=False),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('metric_name', sa.String(), nullable=True),
            sa.Column('observed_value', sa.Float(), nullable=True),
            sa.Column('threshold_value', sa.Float(), nullable=True),
            sa.Column('model_version', sa.String(), nullable=False, index=True),
            sa.Column('status', sa.String(), server_default='OPEN', nullable=False, index=True),
            sa.Column('acknowledged_by', sa.String(), nullable=True),
            sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
            sa.Column('resolved_by', sa.String(), nullable=True),
            sa.Column('resolved_at', sa.DateTime(), nullable=True),
            sa.Column('resolution_notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, index=True),
        )


def downgrade() -> None:
    """Drop credit decision intelligence and governance tables."""
    op.drop_table('governance_alerts')
    op.drop_table('model_drift_snapshots')
    op.drop_table('model_registry_records')
    op.drop_table('decision_overrides')
    op.drop_table('credit_reviews')
    op.drop_table('policy_evaluations')
    op.drop_table('credit_policies')
