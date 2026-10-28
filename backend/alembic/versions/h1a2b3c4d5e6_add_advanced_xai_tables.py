"""add_advanced_xai_tables

Revision ID: h1a2b3c4d5e6
Revises: g1a2b3c4d5e6
Create Date: 2026-10-15 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'h1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'g1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create Advanced XAI tables and indexes if they do not exist."""
    conn = op.get_bind()
    existing_tables = []
    if conn is not None:
        try:
            inspector = inspect(conn)
            existing_tables = inspector.get_table_names()
        except Exception:
            existing_tables = []

    # 1. model_explanations
    if 'model_explanations' not in existing_tables:
        op.create_table(
            'model_explanations',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('assessment_id', sa.Integer(), sa.ForeignKey('assessments.id', ondelete='CASCADE'), unique=True, nullable=False, index=True),
            sa.Column('model_version', sa.String(), nullable=False, index=True),
            sa.Column('explainer_type', sa.String(), server_default='TreeSHAP', nullable=False),
            sa.Column('output_space', sa.String(), server_default='log-odds', nullable=False),
            sa.Column('baseline_value', sa.Float(), nullable=False),
            sa.Column('raw_margin', sa.Float(), nullable=False),
            sa.Column('predicted_probability', sa.Float(), nullable=False),
            sa.Column('risk_level', sa.String(), nullable=False, index=True),
            sa.Column('shap_values', sa.JSON(), nullable=False),
            sa.Column('aggregated_shap_values', sa.JSON(), nullable=False),
            sa.Column('feature_values', sa.JSON(), nullable=False),
            sa.Column('waterfall_steps', sa.JSON(), nullable=False),
            sa.Column('explanation_status', sa.String(), server_default='AVAILABLE', nullable=False, index=True),
            sa.Column('warnings', sa.JSON(), nullable=False),
            sa.Column('calculation_duration_ms', sa.Float(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, index=True),
        )

    # 2. global_importance_snapshots
    if 'global_importance_snapshots' not in existing_tables:
        op.create_table(
            'global_importance_snapshots',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('model_version', sa.String(), nullable=False, index=True),
            sa.Column('dataset_fingerprint', sa.String(), nullable=False, index=True),
            sa.Column('sample_count', sa.Integer(), nullable=False),
            sa.Column('feature_importances', sa.JSON(), nullable=False),
            sa.Column('shap_aggregation_method', sa.String(), server_default='mean_absolute', nullable=False),
            sa.Column('is_valid', sa.Boolean(), server_default=sa.text('true'), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, index=True),
        )

    # 3. counterfactual_simulations
    if 'counterfactual_simulations' not in existing_tables:
        op.create_table(
            'counterfactual_simulations',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('assessment_id', sa.Integer(), sa.ForeignKey('assessments.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('user_id', sa.String(), nullable=False, index=True),
            sa.Column('model_version', sa.String(), nullable=False),
            sa.Column('original_probability', sa.Float(), nullable=False),
            sa.Column('original_risk_level', sa.String(), nullable=False),
            sa.Column('target_risk_level', sa.String(), nullable=False),
            sa.Column('status', sa.String(), server_default='FOUND', nullable=False, index=True),
            sa.Column('proposed_changes', sa.JSON(), nullable=False),
            sa.Column('counterfactual_probability', sa.Float(), nullable=False),
            sa.Column('counterfactual_risk_level', sa.String(), nullable=False),
            sa.Column('search_constraints', sa.JSON(), nullable=False),
            sa.Column('execution_duration_ms', sa.Float(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, index=True),
        )


def downgrade() -> None:
    """Safely drop Advanced XAI tables."""
    conn = op.get_bind()
    existing_tables = []
    if conn is not None:
        try:
            inspector = inspect(conn)
            existing_tables = inspector.get_table_names()
        except Exception:
            existing_tables = ['counterfactual_simulations', 'global_importance_snapshots', 'model_explanations']
    else:
        existing_tables = ['counterfactual_simulations', 'global_importance_snapshots', 'model_explanations']

    if 'counterfactual_simulations' in existing_tables:
        op.drop_table('counterfactual_simulations')
    if 'global_importance_snapshots' in existing_tables:
        op.drop_table('global_importance_snapshots')
    if 'model_explanations' in existing_tables:
        op.drop_table('model_explanations')
