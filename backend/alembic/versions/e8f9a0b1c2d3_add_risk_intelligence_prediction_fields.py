"""add_risk_intelligence_prediction_fields

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-10-06 10:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'e8f9a0b1c2d3'
down_revision: Union[str, Sequence[str], None] = 'd7e8f9a0b1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from alembic import context

def upgrade() -> None:
    """Upgrade predictions table with risk score, data quality, and explanation fields."""
    is_offline = context.is_offline_mode()
    conn = op.get_bind()
    existing_tables = []
    columns = []
    if not is_offline and conn is not None:
        try:
            inspector = inspect(conn)
            existing_tables = inspector.get_table_names()
            if 'predictions' in existing_tables:
                columns = [c['name'] for c in inspector.get_columns('predictions')]
        except Exception:
            existing_tables = []
            columns = []
    
    if is_offline or ('predictions' in existing_tables):
        if is_offline or ('risk_score' not in columns):
            op.add_column('predictions', sa.Column('risk_score', sa.Float(), nullable=True, server_default='0.0'))
        if is_offline or ('data_quality_score' not in columns):
            op.add_column('predictions', sa.Column('data_quality_score', sa.Float(), nullable=True, server_default='100.0'))
        if is_offline or ('factor_breakdown' not in columns):
            op.add_column('predictions', sa.Column('factor_breakdown', sa.JSON(), nullable=True))
        if is_offline or ('analyst_summary' not in columns):
            op.add_column('predictions', sa.Column('analyst_summary', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    is_offline = context.is_offline_mode()
    conn = op.get_bind()
    existing_tables = []
    columns = []
    if not is_offline and conn is not None:
        try:
            inspector = inspect(conn)
            existing_tables = inspector.get_table_names()
            if 'predictions' in existing_tables:
                columns = [c['name'] for c in inspector.get_columns('predictions')]
        except Exception:
            existing_tables = []
            columns = []

    if is_offline or ('predictions' in existing_tables):
        if is_offline or ('analyst_summary' in columns):
            op.drop_column('predictions', 'analyst_summary')
        if is_offline or ('factor_breakdown' in columns):
            op.drop_column('predictions', 'factor_breakdown')
        if is_offline or ('data_quality_score' in columns):
            op.drop_column('predictions', 'data_quality_score')
        if is_offline or ('risk_score' in columns):
            op.drop_column('predictions', 'risk_score')
