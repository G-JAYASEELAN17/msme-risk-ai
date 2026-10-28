"""add_financial_intelligence_tables

Revision ID: g1a2b3c4d5e6
Revises: f9a0b1c2d3e4
Create Date: 2026-10-14 23:59:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'g1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create financial intelligence tables and indexes if they do not exist."""
    conn = op.get_bind()
    existing_tables = []
    if conn is not None:
        try:
            inspector = inspect(conn)
            existing_tables = inspector.get_table_names()
        except Exception:
            existing_tables = []

    # 1. financial_metric_records
    if 'financial_metric_records' not in existing_tables:
        op.create_table(
            'financial_metric_records',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('user_id', sa.String(), sa.ForeignKey('users.uid', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('business_id', sa.Integer(), sa.ForeignKey('businesses.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('metric_key', sa.String(), nullable=False, index=True),
            sa.Column('metric_name', sa.String(), nullable=False),
            sa.Column('calculated_value', sa.Float(), nullable=True),
            sa.Column('unit', sa.String(), server_default='INR', nullable=False),
            sa.Column('period_start', sa.String(), nullable=True),
            sa.Column('period_end', sa.String(), nullable=True),
            sa.Column('formula', sa.Text(), nullable=True),
            sa.Column('provenance_type', sa.String(), server_default='CALCULATED', nullable=False),
            sa.Column('data_completeness', sa.String(), server_default='COMPLETE', nullable=False),
            sa.Column('verification_limitations', sa.Text(), nullable=True),
            sa.Column('source_records_summary', sa.JSON(), nullable=False),
            sa.Column('is_stale', sa.Boolean(), server_default=sa.text('false'), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )

    # 2. financial_discrepancies
    if 'financial_discrepancies' not in existing_tables:
        op.create_table(
            'financial_discrepancies',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('user_id', sa.String(), sa.ForeignKey('users.uid', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('business_id', sa.Integer(), sa.ForeignKey('businesses.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('discrepancy_code', sa.String(), nullable=False, index=True),
            sa.Column('title', sa.String(), nullable=False),
            sa.Column('severity', sa.String(), server_default='MEDIUM', nullable=False, index=True),
            sa.Column('affected_field', sa.String(), nullable=False),
            sa.Column('expected_value', sa.String(), nullable=True),
            sa.Column('observed_value', sa.String(), nullable=True),
            sa.Column('source_document_id', sa.Integer(), sa.ForeignKey('documents.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('reporting_period', sa.String(), nullable=True),
            sa.Column('difference_amount', sa.Float(), nullable=True),
            sa.Column('difference_percentage', sa.Float(), nullable=True),
            sa.Column('detection_rule', sa.Text(), nullable=True),
            sa.Column('explanation', sa.Text(), nullable=False),
            sa.Column('verification_status', sa.String(), server_default='OPEN', nullable=False, index=True),
            sa.Column('analyst_resolution', sa.Text(), nullable=True),
            sa.Column('resolved_by', sa.String(), nullable=True),
            sa.Column('resolved_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )

    # 3. financial_analysis_runs
    if 'financial_analysis_runs' not in existing_tables:
        op.create_table(
            'financial_analysis_runs',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('user_id', sa.String(), sa.ForeignKey('users.uid', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('business_id', sa.Integer(), sa.ForeignKey('businesses.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('status', sa.String(), server_default='COMPLETED', nullable=False, index=True),
            sa.Column('trigger_source', sa.String(), server_default='MANUAL', nullable=False),
            sa.Column('summary', sa.JSON(), nullable=False),
            sa.Column('data_quality_score', sa.Float(), server_default='100.0', nullable=False),
            sa.Column('data_quality_breakdown', sa.JSON(), nullable=False),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('started_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
        )

    # 4. transaction_classification_audits
    if 'transaction_classification_audits' not in existing_tables:
        op.create_table(
            'transaction_classification_audits',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('transaction_id', sa.Integer(), sa.ForeignKey('bank_transactions.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('user_id', sa.String(), nullable=False, index=True),
            sa.Column('previous_category', sa.String(), nullable=False),
            sa.Column('new_category', sa.String(), nullable=False),
            sa.Column('reason', sa.Text(), nullable=False),
            sa.Column('performed_by', sa.String(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    """Drop financial intelligence tables."""
    conn = op.get_bind()
    existing_tables = []
    if conn is not None:
        try:
            inspector = inspect(conn)
            existing_tables = inspector.get_table_names()
        except Exception:
            existing_tables = []

    if 'transaction_classification_audits' in existing_tables:
        op.drop_table('transaction_classification_audits')
    if 'financial_analysis_runs' in existing_tables:
        op.drop_table('financial_analysis_runs')
    if 'financial_discrepancies' in existing_tables:
        op.drop_table('financial_discrepancies')
    if 'financial_metric_records' in existing_tables:
        op.drop_table('financial_metric_records')
