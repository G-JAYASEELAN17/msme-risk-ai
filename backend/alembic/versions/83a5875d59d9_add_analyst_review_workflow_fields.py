"""add_analyst_review_workflow_fields

Revision ID: 83a5875d59d9
Revises: 
Create Date: 2026-10-03 14:40:45.177044

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '83a5875d59d9'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('assessments')]
    if 'additional_comments' not in columns:
        op.add_column('assessments', sa.Column('additional_comments', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('assessments')]
    if 'additional_comments' in columns:
        op.drop_column('assessments', 'additional_comments')
