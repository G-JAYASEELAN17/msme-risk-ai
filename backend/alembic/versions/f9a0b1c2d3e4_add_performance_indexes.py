"""add_performance_indexes

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-10-07 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'f9a0b1c2d3e4'
down_revision: Union[str, Sequence[str], None] = 'e8f9a0b1c2d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from alembic import context

def upgrade() -> None:
    """Create performance indexes on frequently queried fields."""
    is_offline = context.is_offline_mode()
    conn = op.get_bind()
    existing_tables = []
    indexes_by_table = {}
    if not is_offline and conn is not None:
        try:
            inspector = inspect(conn)
            existing_tables = inspector.get_table_names()
            for t in ['assessments', 'predictions', 'businesses', 'documents', 'audit_logs']:
                if t in existing_tables:
                    indexes_by_table[t] = [idx['name'] for idx in inspector.get_indexes(t)]
        except Exception:
            existing_tables = []
            indexes_by_table = {}

    # 1. Assessment indexes: business_id, created_at, review_status
    if is_offline or ('assessments' in existing_tables):
        existing_indexes = indexes_by_table.get('assessments', [])
        if is_offline or ('ix_assessments_business_id' not in existing_indexes):
            op.create_index('ix_assessments_business_id', 'assessments', ['business_id'], unique=False)
        if is_offline or ('ix_assessments_created_at' not in existing_indexes):
            op.create_index('ix_assessments_created_at', 'assessments', ['created_at'], unique=False)
        if is_offline or ('ix_assessments_review_status' not in existing_indexes):
            op.create_index('ix_assessments_review_status', 'assessments', ['review_status'], unique=False)

    # 2. Prediction indexes: assessment_id, risk_level
    if is_offline or ('predictions' in existing_tables):
        existing_indexes = indexes_by_table.get('predictions', [])
        if is_offline or ('ix_predictions_assessment_id' not in existing_indexes):
            op.create_index('ix_predictions_assessment_id', 'predictions', ['assessment_id'], unique=False)
        if is_offline or ('ix_predictions_risk_level' not in existing_indexes):
            op.create_index('ix_predictions_risk_level', 'predictions', ['risk_level'], unique=False)

    # 3. Business indexes: user_id
    if is_offline or ('businesses' in existing_tables):
        existing_indexes = indexes_by_table.get('businesses', [])
        if is_offline or ('ix_businesses_user_id' not in existing_indexes):
            op.create_index('ix_businesses_user_id', 'businesses', ['user_id'], unique=False)

    # 4. Document indexes: business_id, status, created_at
    if is_offline or ('documents' in existing_tables):
        existing_indexes = indexes_by_table.get('documents', [])
        if is_offline or ('ix_documents_business_id' not in existing_indexes):
            op.create_index('ix_documents_business_id', 'documents', ['business_id'], unique=False)
        if is_offline or ('ix_documents_status' not in existing_indexes):
            op.create_index('ix_documents_status', 'documents', ['status'], unique=False)
        if is_offline or ('ix_documents_created_at' not in existing_indexes):
            op.create_index('ix_documents_created_at', 'documents', ['created_at'], unique=False)

    # 5. AuditLog indexes: user_id, action, created_at
    if is_offline or ('audit_logs' in existing_tables):
        existing_indexes = indexes_by_table.get('audit_logs', [])
        if is_offline or ('ix_audit_logs_user_id' not in existing_indexes):
            op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'], unique=False)
        if is_offline or ('ix_audit_logs_action' not in existing_indexes):
            op.create_index('ix_audit_logs_action', 'audit_logs', ['action'], unique=False)
        if is_offline or ('ix_audit_logs_created_at' not in existing_indexes):
            op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'], unique=False)


def downgrade() -> None:
    """Drop performance indexes."""
    is_offline = context.is_offline_mode()
    conn = op.get_bind()
    existing_tables = []
    indexes_by_table = {}
    if not is_offline and conn is not None:
        try:
            inspector = inspect(conn)
            existing_tables = inspector.get_table_names()
            for t in ['assessments', 'predictions', 'documents', 'audit_logs']:
                if t in existing_tables:
                    indexes_by_table[t] = [idx['name'] for idx in inspector.get_indexes(t)]
        except Exception:
            existing_tables = []
            indexes_by_table = {}

    if is_offline or ('audit_logs' in existing_tables):
        existing_indexes = indexes_by_table.get('audit_logs', [])
        if is_offline or ('ix_audit_logs_created_at' in existing_indexes):
            op.drop_index('ix_audit_logs_created_at', table_name='audit_logs')
        if is_offline or ('ix_audit_logs_action' in existing_indexes):
            op.drop_index('ix_audit_logs_action', table_name='audit_logs')

    if is_offline or ('documents' in existing_tables):
        existing_indexes = indexes_by_table.get('documents', [])
        if is_offline or ('ix_documents_created_at' in existing_indexes):
            op.drop_index('ix_documents_created_at', table_name='documents')
        if is_offline or ('ix_documents_status' in existing_indexes):
            op.drop_index('ix_documents_status', table_name='documents')

    if is_offline or ('predictions' in existing_tables):
        existing_indexes = indexes_by_table.get('predictions', [])
        if is_offline or ('ix_predictions_risk_level' in existing_indexes):
            op.drop_index('ix_predictions_risk_level', table_name='predictions')

    if is_offline or ('assessments' in existing_tables):
        existing_indexes = indexes_by_table.get('assessments', [])
        if is_offline or ('ix_assessments_review_status' in existing_indexes):
            op.drop_index('ix_assessments_review_status', table_name='assessments')
        if is_offline or ('ix_assessments_created_at' in existing_indexes):
            op.drop_index('ix_assessments_created_at', table_name='assessments')
