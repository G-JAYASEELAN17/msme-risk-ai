"""add_document_intelligence_and_extracted_fields

Revision ID: d7e8f9a0b1c2
Revises: 83a5875d59d9
Create Date: 2026-10-06 10:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'd7e8f9a0b1c2'
down_revision: Union[str, Sequence[str], None] = '83a5875d59d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from alembic import context

def upgrade() -> None:
    """Upgrade schema with document intelligence fields and extracted_fields table."""
    is_offline = context.is_offline_mode()
    conn = op.get_bind()
    existing_tables = []
    doc_cols = []
    if not is_offline and conn is not None:
        try:
            inspector = inspect(conn)
            existing_tables = inspector.get_table_names()
            if 'documents' in existing_tables:
                doc_cols = [c['name'] for c in inspector.get_columns('documents')]
        except Exception:
            existing_tables = []
            doc_cols = []
    
    # 1. Update documents table
    if is_offline or ('documents' in existing_tables):
        if is_offline or ('document_type' not in doc_cols):
            op.add_column('documents', sa.Column('document_type', sa.String(50), nullable=False, server_default='OTHER'))
        if is_offline or ('processing_status' not in doc_cols):
            op.add_column('documents', sa.Column('processing_status', sa.String(50), nullable=False, server_default='UPLOADED'))
        if is_offline or ('error_message' not in doc_cols):
            op.add_column('documents', sa.Column('error_message', sa.Text(), nullable=True))
        if is_offline or ('updated_at' not in doc_cols):
            op.add_column('documents', sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()))

    # 2. Create extracted_fields table
    if is_offline or ('extracted_fields' not in existing_tables):
        op.create_table(
            'extracted_fields',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('document_id', sa.Integer(), sa.ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('field_name', sa.String(100), nullable=False, index=True),
            sa.Column('raw_value', sa.Text(), nullable=True),
            sa.Column('normalized_value', sa.Float(), nullable=True),
            sa.Column('string_value', sa.String(255), nullable=True),
            sa.Column('confidence', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('source_page', sa.Integer(), nullable=True, server_default='1'),
            sa.Column('extraction_method', sa.String(50), nullable=False, server_default='native_text'),
            sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('is_manually_edited', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('verified_value', sa.Text(), nullable=True),
            sa.Column('verified_by', sa.String(100), nullable=True),
            sa.Column('verified_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )


def downgrade() -> None:
    """Downgrade schema."""
    is_offline = context.is_offline_mode()
    conn = op.get_bind()
    existing_tables = []
    doc_cols = []
    if not is_offline and conn is not None:
        try:
            inspector = inspect(conn)
            existing_tables = inspector.get_table_names()
            if 'documents' in existing_tables:
                doc_cols = [c['name'] for c in inspector.get_columns('documents')]
        except Exception:
            existing_tables = []
            doc_cols = []

    if is_offline or ('extracted_fields' in existing_tables):
        op.drop_table('extracted_fields')

    if is_offline or ('documents' in existing_tables):
        if is_offline or ('updated_at' in doc_cols):
            op.drop_column('documents', 'updated_at')
        if is_offline or ('error_message' in doc_cols):
            op.drop_column('documents', 'error_message')
        if is_offline or ('processing_status' in doc_cols):
            op.drop_column('documents', 'processing_status')
        if is_offline or ('document_type' in doc_cols):
            op.drop_column('documents', 'document_type')
